FROM node:22

WORKDIR /app

COPY package*.json ./

RUN npm install

# RUN npm install -g nodemon

COPY . .

ENV PORT=5000

EXPOSE 5000

# CMD ["npm", "start"]

CMD ["sh", "-c", "echo 'Waiting 10 seconds before starting...'; sleep 10; npm start"]
