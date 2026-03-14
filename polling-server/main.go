package main

import (
	"context"
	"fmt"
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

func setupRouter(client *redis.Client) *gin.Engine {
	r := gin.Default()

	// Endpoint for the consumer to check if the key exists in Redis
	r.GET("/consumer", func(c *gin.Context) {
		key := c.Query("correlationID")

		// Check if the key exists in Redis
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()

		val, err := client.Get(ctx, key).Result()
		if err != nil {
			// Key does not exist in Redis
			c.JSON(http.StatusOK, gin.H{
				"exists": false,
			})
		} else {
			// Key exists in Redis
			c.JSON(http.StatusOK, gin.H{
				"exists": true,
				"body":   val,
			})
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
