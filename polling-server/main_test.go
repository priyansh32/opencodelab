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

	var body executionStatus
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if body.Exists {
		t.Fatalf("expected exists=false for missing key")
	}
	if body.Status != statusQueued {
		t.Fatalf("expected status %q, got %q", statusQueued, body.Status)
	}
}

func TestConsumerReturnsLegacyBodyWhenKeyExists(t *testing.T) {
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

	var body executionStatus
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if !body.Exists {
		t.Fatalf("expected exists=true for existing key")
	}
	if body.Body != "program output" {
		t.Fatalf("expected body to match redis value")
	}
	if body.Status != statusCompleted {
		t.Fatalf("expected status %q, got %q", statusCompleted, body.Status)
	}
}

func TestConsumerUsesStoredExecutionMetadataStatus(t *testing.T) {
	gin.SetMode(gin.TestMode)
	miniRedis := miniredis.RunT(t)
	miniRedis.Set("exec-123", "{\"schema\":\"opencodelab.execution.v1\",\"status\":\"failed\",\"body\":\"runtime failure\"}")

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

	var body executionStatus
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if body.Status != statusFailed {
		t.Fatalf("expected status %q, got %q", statusFailed, body.Status)
	}
	if body.Body != "runtime failure" {
		t.Fatalf("expected body to match stored metadata body")
	}
}

func TestConsumerDoesNotTrustUnscopedJSONAsMetadata(t *testing.T) {
	gin.SetMode(gin.TestMode)
	miniRedis := miniredis.RunT(t)
	miniRedis.Set("exec-123", "{\"status\":\"timeout\",\"body\":\"spoofed\"}")

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

	var body executionStatus
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if body.Status != statusCompleted {
		t.Fatalf("expected fallback status %q, got %q", statusCompleted, body.Status)
	}
	if body.Body != "{\"status\":\"timeout\",\"body\":\"spoofed\"}" {
		t.Fatalf("expected raw body fallback for unscoped json payload")
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
