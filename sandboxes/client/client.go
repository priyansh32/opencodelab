package client

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sync"
	"time"

	utils "sandboxes/utils"

	amqp "github.com/rabbitmq/amqp091-go"
	"github.com/redis/go-redis/v9"
)

func consumer(conn *amqp.Connection, queueName string, ds chan amqp.Delivery, wg *sync.WaitGroup) {
	ch, err := conn.Channel()
	utils.FailOnError(err, "Failed to open a channel")

	defer wg.Done()
	defer ch.Close()

	dlxName := queueName + ".dlx"
	dlqName := queueName + ".dlq"

	err = ch.ExchangeDeclare(
		dlxName, // name
		"direct",
		true, // durable
		false, // auto-delete
		false, // internal
		false, // no-wait
		nil,
	)
	utils.FailOnError(err, "Failed to declare dead-letter exchange")

	_, err = ch.QueueDeclare(
		dlqName, // name
		true,    // durable
		false,   // delete when unused
		false,   // exclusive
		false,   // no-wait
		nil,     // arguments
	)
	utils.FailOnError(err, "Failed to declare dead-letter queue")

	err = ch.QueueBind(
		dlqName,
		queueName,
		dlxName,
		false,
		nil,
	)
	utils.FailOnError(err, "Failed to bind dead-letter queue")

	q, err := ch.QueueDeclare(
		queueName, // name
		true,      // durable
		false,     // delete when unused
		false,     // exclusive
		false,     // no-wait
		amqp.Table{
			"x-dead-letter-exchange":    dlxName,
			"x-dead-letter-routing-key": queueName,
		},
	)
	utils.FailOnError(err, "Failed to declare a queue")

	err = ch.Qos(1, 0, false)
	utils.FailOnError(err, "Failed to set QoS")

	// register a consumer
	_ds, err := ch.Consume(
		q.Name, // queue
		"",     // consumer
		false,  // auto-ack
		false,  // exclusive
		false,  // no-wait
		false,  // no-local
		nil,    // args
	)

	utils.FailOnError(err, "Failed to register a consumer")

	for d := range _ds {
		fmt.Printf("Received a message: %s\n", d.Body)
		ds <- d
	}
}

func sandboxWorker(ds chan amqp.Delivery, responses chan utils.Response, executeCode func(string) string, wg *sync.WaitGroup) {
	defer wg.Done()

	for d := range ds {
		var messageBody utils.Message

		err := json.Unmarshal(d.Body, &messageBody)
		if err != nil {
			log.Printf("Error decoding JSON: %s", err)
			if nackErr := d.Nack(false, false); nackErr != nil {
				log.Printf("Failed to Nack malformed message: %s", nackErr)
			}
			continue
		}
		response := utils.Response{
			ReplyTo:       d.ReplyTo,
			CorrelationID: d.CorrelationId,
			Body:          executeCode(messageBody.Code),
		}

		if ackErr := d.Ack(false); ackErr != nil {
			log.Printf("Failed to Ack message: %s", ackErr)
			continue
		}

		responses <- response
	}
}

func redisWorker(responses chan utils.Response, wg *sync.WaitGroup) {
	client := redis.NewClient(&redis.Options{
		Addr:     os.Getenv("REDIS_URL"),
		Password: "",
		DB:       0,
	})

	defer wg.Done()
	defer client.Close()

	for response := range responses {
		err := client.Set(context.Background(), response.CorrelationID, response.Body, 10*time.Minute).Err()
		utils.FailOnError(err, "Failed to set response in redis")
	}
}

func Initialize(queueName string, executeCode func(string) string) {
	conn, err := amqp.Dial(os.Getenv("RABBITMQ_URL"))
	utils.FailOnError(err, "Failed to connect to RabbitMQ")
	defer conn.Close()

	ds := make(chan amqp.Delivery)
	responses := make(chan utils.Response)

	wq := sync.WaitGroup{}
	wq.Add(3)

	go consumer(conn, queueName, ds, &wq)
	go sandboxWorker(ds, responses, executeCode, &wq)
	go redisWorker(responses, &wq)

	wq.Wait()
}

/*
unused functions
not deleting b/c I wrote them and I'm proud of them
It feels like a personal loss to delete them
I'm not ready to let go yet
they are bad but they are minef


var containerConfigs = map[string]func(code string) *container.Config{
	"python": func(code string) *container.Config {
		return &container.Config{
			Image: "python:3.10-alpine3.18",
			Cmd:   []string{"python", "-c", code},
		}
	},
	"javascript": func(code string) *container.Config {
		return &container.Config{
			Image: "node:18.16-alpine3.18",
			Cmd:   []string{"node", "-e", code},
		}
	},
}

func ExecuteCodeInSandbox(dockerClient *client.Client, language string, code string) string {

	sandbox, err := dockerClient.ContainerCreate(
		context.Background(),
		containerConfigs[language](code),
		&container.HostConfig{
			AutoRemove: false,
		},
		nil, // networking config
		nil, // platform config
		"",
	)

	defer dockerClient.ContainerRemove(
		context.Background(),
		sandbox.ID,
		types.ContainerRemoveOptions{
			RemoveVolumes: true,
			Force:         true,
		},
	)

	if err != nil {
		log.Printf("Error creating container: %s", err)
		return ""
	}

	if err != nil {
		log.Printf("Error getting container logs: %s", err)
		return ""
	}

	err = dockerClient.ContainerStart(
		context.Background(),
		sandbox.ID,
		types.ContainerStartOptions{},
	)

	if err != nil {
		log.Printf("Error starting container: %s", err)
		return ""
	}

	statusCh, errCh := dockerClient.ContainerWait(
		context.Background(),
		sandbox.ID,
		container.WaitConditionNotRunning,
	)

	var out string
	select {
	case err := <-errCh:
		if err != nil {
			log.Printf("Error waiting for container: %s", err)
			out = ""
		}
	case <-statusCh:
		logs, err := dockerClient.ContainerLogs(
			context.Background(),
			sandbox.ID,
			types.ContainerLogsOptions{
				ShowStdout: true,
				ShowStderr: true,
			},
		)
		// defer logs.Close()

		if err != nil {
			log.Printf("Error getting container logs: %s", err)
			return ""
		}

		buf := new(bytes.Buffer)
		buf.ReadFrom(logs)
		out = buf.String()
	}

	return out
}
*/
