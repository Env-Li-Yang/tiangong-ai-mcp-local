FROM node:22-alpine

RUN npm install -g @tiangong-ai/mcp-server-local@0.0.1

EXPOSE 9279

CMD ["tiangong-ai-mcp-http"]
