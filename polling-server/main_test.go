package main

import "testing"

func TestParseExecutionResult(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		raw          string
		wantStatus   string
		wantBody     string
	}{
		{
			name:       "raw output remains completed even with timeout text",
			raw:        "Time limit exceeded",
			wantStatus: statusCompleted,
			wantBody:   "Time limit exceeded",
		},
		{
			name:       "uses explicit status from metadata",
			raw:        `{"status":"failed","body":"Traceback"}`,
			wantStatus: statusFailed,
			wantBody:   "Traceback",
		},
		{
			name:       "derives timeout from metadata flag",
			raw:        `{"body":"whatever","timedOut":true}`,
			wantStatus: statusTimeout,
			wantBody:   "whatever",
		},
		{
			name:       "derives failure from non-zero exit code",
			raw:        `{"body":"runtime error","exitCode":1}`,
			wantStatus: statusFailed,
			wantBody:   "runtime error",
		},
		{
			name:       "derives failure from succeeded false",
			raw:        `{"body":"runtime error","succeeded":false}`,
			wantStatus: statusFailed,
			wantBody:   "runtime error",
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			gotStatus, gotBody := parseExecutionResult(tc.raw)
			if gotStatus != tc.wantStatus {
				t.Fatalf("status mismatch: got %q want %q", gotStatus, tc.wantStatus)
			}
			if gotBody != tc.wantBody {
				t.Fatalf("body mismatch: got %q want %q", gotBody, tc.wantBody)
			}
		})
	}
}

func TestParseExecutionResult_StatusPriority(t *testing.T) {
	t.Parallel()

	status, _ := parseExecutionResult(`{"status":"completed","exitCode":1,"timedOut":true}`)
	if status != statusCompleted {
		t.Fatalf("expected explicit status to win, got %q", status)
	}
}
