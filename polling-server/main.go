package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
)

type executionStatus struct {
	CorrelationID string `json:"correlationID"`
	Exists        bool   `json:"exists"`
	Status        string `json:"status"`
	Body          string `json:"body,omitempty"`
	UpdatedAt     string `json:"updatedAt,omitempty"`
	Error         string `json:"error,omitempty"`
}

type redisExecutionRecord struct {
	Schema string `json:"schema"`
	Status string `json:"status"`
	Body   string `json:"body"`
}

const (
	statusCompleted          = "completed"
	statusFailed             = "failed"
	statusTimeout            = "timeout"
	statusQueued             = "queued"
	statusInvalidRequest     = "invalid_request"
	statusBackendUnavailable = "backend_unavailable"
	executionSchemaV1        = "opencodelab.execution.v1"
)

var terminalStatuses = map[string]bool{
	statusCompleted: true,
	statusFailed:    true,
	statusTimeout:   true,
}

// Replace the following Redis connection details with your actual configuration
var redisClient = redis.NewClient(&redis.Options{
	Addr: os.Getenv("REDIS_URL"), // Replace with your Redis server address
	// Replace with your Redis server address
	Password: "", // Replace with your Redis server password (if any)
	DB:       0,  // Replace with your Redis database number
})

func parseStoredExecutionRecord(raw string) (redisExecutionRecord, bool) {
	var record redisExecutionRecord
	if err := json.Unmarshal([]byte(raw), &record); err != nil {
		return redisExecutionRecord{}, false
	}

	if record.Schema != executionSchemaV1 {
		return redisExecutionRecord{}, false
	}

	switch record.Status {
	case statusCompleted, statusFailed, statusTimeout, statusQueued:
		return record, true
	default:
		return redisExecutionRecord{}, false
	}
}

func lookupExecutionStatus(parentContext context.Context, client *redis.Client, key string) (int, executionStatus) {
	if key == "" {
		return http.StatusBadRequest, executionStatus{
			CorrelationID: key,
			Exists:        false,
			Status:        statusInvalidRequest,
			Error:         "missing correlationID query parameter",
		}
	}

	ctx, cancel := context.WithTimeout(parentContext, 3*time.Second)
	defer cancel()

	val, err := client.Get(ctx, key).Result()
	if errors.Is(err, redis.Nil) {
		return http.StatusOK, executionStatus{
			CorrelationID: key,
			Exists:        false,
			Status:        statusQueued,
			UpdatedAt:     time.Now().UTC().Format(time.RFC3339),
		}
	}

	if err != nil {
		log.Printf("Redis lookup failed for %s: %v", key, err)
		return http.StatusServiceUnavailable, executionStatus{
			CorrelationID: key,
			Exists:        false,
			Status:        statusBackendUnavailable,
			Error:         "polling backend unavailable",
			UpdatedAt:     time.Now().UTC().Format(time.RFC3339),
		}
	}

	if record, ok := parseStoredExecutionRecord(val); ok {
		return http.StatusOK, executionStatus{
			CorrelationID: key,
			Exists:        true,
			Status:        record.Status,
			Body:          record.Body,
			UpdatedAt:     time.Now().UTC().Format(time.RFC3339),
		}
	}

	// Backward compatibility for legacy records stored as raw output strings.
	return http.StatusOK, executionStatus{
		CorrelationID: key,
		Exists:        true,
		Status:        statusCompleted,
		Body:          val,
		UpdatedAt:     time.Now().UTC().Format(time.RFC3339),
	}
}

func setupRouter(client *redis.Client) *gin.Engine {
	r := gin.Default()

	r.GET("/consumer", func(c *gin.Context) {
		key := c.Query("correlationID")
		statusCode, payload := lookupExecutionStatus(c.Request.Context(), client, key)
		c.JSON(statusCode, payload)
	})

	r.GET("/consumer/stream", func(c *gin.Context) {
		key := c.Query("correlationID")
		if key == "" {
			statusCode, payload := lookupExecutionStatus(c.Request.Context(), client, key)
			c.JSON(statusCode, payload)
			return
		}

		flusher, ok := c.Writer.(http.Flusher)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "streaming not supported"})
			return
		}

		c.Header("Content-Type", "text/event-stream")
		c.Header("Cache-Control", "no-cache")
		c.Header("Connection", "keep-alive")

		sendStatus := func(payload executionStatus) {
			data, err := json.Marshal(payload)
			if err != nil {
				log.Printf("Failed to marshal status payload for key %s: %v", payload.CorrelationID, err)
				return
			}
			fmt.Fprintf(c.Writer, "event: status\n")
			fmt.Fprintf(c.Writer, "data: %s\n\n", data)
			flusher.Flush()
		}

		for {
			statusCode, payload := lookupExecutionStatus(c.Request.Context(), client, key)
			sendStatus(payload)

			if statusCode != http.StatusOK {
				return
			}

			if terminalStatuses[payload.Status] {
				return
			}

			select {
			case <-c.Request.Context().Done():
				return
			case <-time.After(1 * time.Second):
			}
		}
	})

	return r
}

func main() {
	r := setupRouter(redisClient)

	// Start the server on port 8080 (can be any other port of your choice)
	if err := r.Run(":8080"); err != nil {
		fmt.Println("Error starting the server:", err)
	}
}
