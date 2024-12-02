#!/bin/bash

# Randomly increment totals for GET, POST, and DELETE requests
total_get=0
total_post=0
total_delete=0

while true; do
  # Simulate GET request
  total_get=$((total_get + RANDOM % 5 + 1))
  curl -X GET "http://localhost:3000/hello/Torkel"
  
  # Sleep for a random duration between 10-20 seconds
  sleep $((RANDOM % 10 + 10))
  
  # Simulate POST request
  total_post=$((total_post + RANDOM % 5 + 1))
  curl -X POST -H "Content-Type: application/json" \
       -d '{"newGreeting":"Hi"}' "http://localhost:3000/greeting"
  
  # Sleep for a random duration between 10-20 seconds
  sleep $((RANDOM % 10 + 10))
  
  # Simulate DELETE request
  total_delete=$((total_delete + RANDOM % 5 + 1))
  curl -X DELETE "http://localhost:3000/greeting"
  
  # Sleep for a random duration between 10-20 seconds
  sleep $((RANDOM % 10 + 10))
done
