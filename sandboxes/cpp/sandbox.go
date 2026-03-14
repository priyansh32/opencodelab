package main

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"sandboxes/client"
	utils "sandboxes/utils"
	"time"
)

const (
	compileTimeout = 8 * time.Second
	runTimeout     = 2 * time.Second
)

func executeCode(code string) utils.ExecutionResult {
	tmpDir, err := os.MkdirTemp("", "cpp-run-*")
	if err != nil {
		return utils.ExecutionResult{
			Status: utils.StatusFailed,
			Body:   "Failed to prepare sandbox workspace: " + err.Error(),
		}
	}
	defer os.RemoveAll(tmpDir)

	sourcePath := filepath.Join(tmpDir, "main.cpp")
	binaryPath := filepath.Join(tmpDir, "program")

	if err := os.WriteFile(sourcePath, []byte(code), 0o600); err != nil {
		return utils.ExecutionResult{
			Status: utils.StatusFailed,
			Body:   "Failed to write source file: " + err.Error(),
		}
	}

	compileCtx, cancelCompile := context.WithTimeout(context.Background(), compileTimeout)
	defer cancelCompile()

	compileCmd := exec.CommandContext(compileCtx, "g++", sourcePath, "-O2", "-pipe", "-std=c++17", "-o", binaryPath)
	compileOut, compileErr := compileCmd.CombinedOutput()
	if compileCtx.Err() == context.DeadlineExceeded {
		return utils.ExecutionResult{
			Status: utils.StatusTimeout,
			Body:   "Compilation time limit exceeded",
		}
	}
	if compileErr != nil {
		return utils.ExecutionResult{
			Status: utils.StatusFailed,
			Body:   compileErr.Error() + "\n" + string(compileOut),
		}
	}

	runCtx, cancelRun := context.WithTimeout(context.Background(), runTimeout)
	defer cancelRun()

	runCmd := exec.CommandContext(runCtx, binaryPath)
	runOut, runErr := runCmd.CombinedOutput()
	if runCtx.Err() == context.DeadlineExceeded {
		return utils.ExecutionResult{
			Status: utils.StatusTimeout,
			Body:   "Time limit exceeded",
		}
	}
	if runErr != nil {
		return utils.ExecutionResult{
			Status: utils.StatusFailed,
			Body:   runErr.Error() + "\n" + string(runOut),
		}
	}

	return utils.ExecutionResult{
		Status: utils.StatusCompleted,
		Body:   string(runOut),
	}
}

func main() {
	client.Initialize("cpp_latest", executeCode)
}
