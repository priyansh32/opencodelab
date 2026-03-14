package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
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

var terminalStatuses = map[string]bool{
	"completed": true,
	"failed":    true,
	"timeout":   true,
}

// Replace the following Redis connection details with your actual configuration
var redisClient = redis.NewClient(&redis.Options{
	Addr: os.Getenv("REDIS_URL"), // Replace with your Redis server address
	// Replace with your Redis server address
	Password: "", // Replace with your Redis server password (if any)
	DB:       0,  // Replace with your Redis database number
})

func inferStatus(body string) string {
	trimmed := strings.TrimSpace(body)
	switch {
	case strings.Contains(trimmed, "Time limit exceeded"):
		return "timeout"
	case strings.Contains(trimmed, "Traceback"):
		return "failed"
	case strings.Contains(trimmed, "SyntaxError"):
		return "failed"
	case strings.Contains(trimmed, "ReferenceError"):
		return "failed"
	case strings.Contains(trimmed, "exit status"):
		return "failed"
	default:
		return "completed"
	}
}

func lookupExecutionStatus(client *redis.Client, key string) (int, executionStatus) {
	if key == "" {
		return http.StatusBadRequest, executionStatus{
			CorrelationID: key,
			Exists:        false,
			Status:        "invalid_request",
			Error:         "missing correlationID query parameter",
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	val, err := client.Get(ctx, key).Result()
	if errors.Is(err, redis.Nil) {
		return http.StatusOK, executionStatus{
			CorrelationID: key,
			Exists:        false,
			Status:        "queued",
			UpdatedAt:     time.Now().UTC().Format(time.RFC3339),
		}
	}

	if err != nil {
		log.Printf("Redis lookup failed for %s: %v", key, err)
		return http.StatusServiceUnavailable, executionStatus{
			CorrelationID: key,
			Exists:        false,
			Status:        "backend_unavailable",
			Error:         "polling backend unavailable",
			UpdatedAt:     time.Now().UTC().Format(time.RFC3339),
		}
	}

	return http.StatusOK, executionStatus{
		CorrelationID: key,
		Exists:        true,
		Status:        inferStatus(val),
		Body:          val,
		UpdatedAt:     time.Now().UTC().Format(time.RFC3339),
	}
}

func setupRouter(client *redis.Client) *gin.Engine {
	r := gin.Default()

	r.GET("/consumer", func(c *gin.Context) {
		key := c.Query("correlationID")
		statusCode, payload := lookupExecutionStatus(client, key)
		c.JSON(statusCode, payload)
	})

	r.GET("/consumer/stream", func(c *gin.Context) {
		key := c.Query("correlationID")
		if key == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "missing correlationID query parameter",
			})
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
				return
			}
			fmt.Fprintf(c.Writer, "event: status\n")
			fmt.Fprintf(c.Writer, "data: %s\n\n", data)
			flusher.Flush()
		}

		for {
			statusCode, payload := lookupExecutionStatus(client, key)
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
