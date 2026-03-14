package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"sandboxes/client"
	utils "sandboxes/utils"
	"strings"
	"time"
)

var (
	pythonExecutable    string
	pythonExecutableErr error
)

func init() {
	pythonExecutable, pythonExecutableErr = resolvePythonExecutable()
}

func resolvePythonExecutable() (string, error) {
	if configured := strings.TrimSpace(os.Getenv("PYTHON_EXECUTABLE")); configured != "" {
		if _, err := exec.LookPath(configured); err != nil {
			return "", fmt.Errorf("PYTHON_EXECUTABLE=%q is not available in PATH", configured)
		}
		return configured, nil
	}

	for _, candidate := range []string{"python3", "python"} {
		if _, err := exec.LookPath(candidate); err == nil {
			return candidate, nil
		}
	}

	return "", fmt.Errorf("no Python interpreter found (tried: python3, python)")
}

func executeCode(code string) utils.ExecutionResult {
	if pythonExecutableErr != nil || pythonExecutable == "" {
		reason := "unknown error"
		if pythonExecutableErr != nil {
			reason = pythonExecutableErr.Error()
		}

		return utils.ExecutionResult{
			Status: utils.StatusFailed,
			Body:   "Python runtime unavailable: " + reason,
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, pythonExecutable, "-c", code)
	out, err := cmd.CombinedOutput()

	if ctx.Err() == context.DeadlineExceeded {
		return utils.ExecutionResult{
			Status: utils.StatusTimeout,
			Body:   "Time limit exceeded",
		}
	}

	result := string(out)
	if err != nil {
		result = err.Error() + "\n" + result
		return utils.ExecutionResult{
			Status: utils.StatusFailed,
			Body:   result,
		}
	}
	return utils.ExecutionResult{
		Status: utils.StatusCompleted,
		Body:   result,
	}
}

func main() {
	if pythonExecutableErr != nil {
		panic(pythonExecutableErr)
	}

	client.Initialize("python313", executeCode)
}
