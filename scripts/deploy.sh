#./scripts/build.sh

# https://s3.console.aws.amazon.com/s3/buckets/courtney-web-apps/?region=us-east-1&tab=overview
aws s3 sync ./build s3://courtney-web-apps --delete

aws cloudfront create-invalidation \
    --distribution-id E3OB8GFQM5BHBX \
    --paths "/*"

# check this page for the status of clearing the cache
# https://console.aws.amazon.com/cloudfront/home?region=us-east-1#distribution-settings:E3OB8GFQM5BHBX


# it deploys to here:
# https://d36jrbyzk88a80.cloudfront.net/
# https://spacebetween.courtney-brown.net/storybook/index.html
