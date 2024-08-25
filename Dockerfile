FROM node:20-alpine

WORKDIR /app

COPY configs ./configs
COPY scripts ./scripts
COPY src ./src
COPY package-lock.json .
COPY package.json .
COPY tsconfig.json .
COPY tsconfig.node.json .
COPY vite.config.ts .

RUN ls -ls
RUN npm ci
RUN npm run build

RUN rm -r ./node_modules
RUN rm -r ./scripts
RUN rm -r ./src
RUN rm package-lock.json
RUN rm package.json
RUN rm tsconfig.json
RUN rm tsconfig.node.json
RUN rm vite.config.ts
RUN ls -ls ./dist

CMD ["node", "dist/webserver/server.cjs"]

EXPOSE 3000