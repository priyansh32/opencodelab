package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
)

// Replace the following Redis connection details with your actual configuration
var redisClient = redis.NewClient(&redis.Options{
	Addr: os.Getenv("REDIS_URL"), // Replace with your Redis server address
	// Replace with your Redis server address
	Password: "", // Replace with your Redis server password (if any)
	DB:       0,  // Replace with your Redis database number
})

type errorResponse struct {
	Error string `json:"error"`
}

type consumerResponse struct {
	Exists bool   `json:"exists"`
	Status string `json:"status"`
	Body   string `json:"body,omitempty"`
}

func main() {
	r := gin.Default()

	// Endpoint for the consumer to check if the key exists in Redis
	r.GET("/consumer", func(c *gin.Context) {
		key := c.Query("correlationID")
		if key == "" {
			c.JSON(http.StatusBadRequest, errorResponse{Error: "missing correlationID query parameter"})
			return
		}

		// Check if the key exists in Redis
		ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
		defer cancel()

		val, err := redisClient.Get(ctx, key).Result()
		if errors.Is(err, redis.Nil) {
			c.JSON(http.StatusOK, consumerResponse{Exists: false, Status: "queued"})
			return
		}

		if err != nil {
			log.Printf("Redis lookup failed for %s: %v", key, err)
			c.JSON(http.StatusServiceUnavailable, errorResponse{Error: "polling backend unavailable"})
			return
		}

		// Key exists in Redis
		c.JSON(http.StatusOK, consumerResponse{Exists: true, Status: "completed", Body: val})
	})

	// Start the server on port 8080 (can be any other port of your choice)
	if err := r.Run(":8080"); err != nil {
		fmt.Println("Error starting the server:", err)
	}
}
