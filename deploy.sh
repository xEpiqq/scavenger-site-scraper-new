#!/bin/bash

npm run sendToLambda

function_name="scavenger-site-scraper"

aws lambda create-function \
  --function-name "$function_name" \
  --runtime nodejs18.x \
  --handler index.handler \
  --memory-size 1557 \
  --timeout 120 \
  --role arn:aws:iam::758260992716:role/service-role/gmaps-scrape-1-role-6ukxrykp \
  --code S3Bucket=scavenger-chrome-aws,S3Key=function.zip \
  --tracing-config Mode=PassThrough
