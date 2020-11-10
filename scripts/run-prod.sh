./scripts/build.sh
# npm run build-storybook
npx http-server ./build --ssl --cert localhost.pem --key localhost-key.pem

# https://localhost:8080/
# https://localhost:8080/storybook/index.html