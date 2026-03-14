package main

import (
	"context"
	"os/exec"
	"sandboxes/client"
	utils "sandboxes/utils"
	"time"
)

func executeCode(code string) utils.ExecutionResult {

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "python3.10", "-c", code)
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
	client.Initialize("python310", executeCode)
}
