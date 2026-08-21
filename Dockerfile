# 使用 Node.js 22 官方镜像（AI SDK 要求 >=22）
FROM node:22-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 lock 文件
COPY package.json ./

# 安装依赖
RUN npm install

# 复制所有源代码
COPY . .

# 构建生产版本
RUN npm run build

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 启动命令
CMD ["npm", "start"]
