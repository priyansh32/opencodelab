package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
)

func TestConsumerReturnsExistsFalseWhenKeyMissing(t *testing.T) {
	gin.SetMode(gin.TestMode)
	miniRedis := miniredis.RunT(t)

	client := redis.NewClient(&redis.Options{
		Addr: miniRedis.Addr(),
	})
	defer client.Close()

	router := setupRouter(client)
	req := httptest.NewRequest(http.MethodGet, "/consumer?correlationID=missing-id", nil)
	res := httptest.NewRecorder()

	router.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}

	var body struct {
		Exists bool `json:"exists"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if body.Exists {
		t.Fatalf("expected exists=false for missing key")
	}
}

func TestConsumerReturnsBodyWhenKeyExists(t *testing.T) {
	gin.SetMode(gin.TestMode)
	miniRedis := miniredis.RunT(t)
	miniRedis.Set("exec-123", "program output")

	client := redis.NewClient(&redis.Options{
		Addr: miniRedis.Addr(),
	})
	defer client.Close()

	router := setupRouter(client)
	req := httptest.NewRequest(http.MethodGet, "/consumer?correlationID=exec-123", nil)
	res := httptest.NewRecorder()

	router.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}

	var body struct {
		Exists bool   `json:"exists"`
		Body   string `json:"body"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if !body.Exists {
		t.Fatalf("expected exists=true for existing key")
	}
	if body.Body != "program output" {
		t.Fatalf("expected body to match redis value")
	}
}

func TestConsumerReturns503OnRedisError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	miniRedis := miniredis.RunT(t)

	client := redis.NewClient(&redis.Options{
		Addr: miniRedis.Addr(),
	})
	defer client.Close()

	router := setupRouter(client)

	miniRedis.Close()

	req := httptest.NewRequest(http.MethodGet, "/consumer?correlationID=any-id", nil)
	res := httptest.NewRecorder()

	router.ServeHTTP(res, req)
	if res.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status %d, got %d", http.StatusServiceUnavailable, res.Code)
	}
}
