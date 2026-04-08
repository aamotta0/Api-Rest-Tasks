import express = require("express");
import cors = require("cors");
import morgan = require("morgan");
import { taskRouter } from "./routes/tasks";
import errorHandler from "./middleware/errorHandler";

const app = express();

// Middlewares

// Nos permite habilitar CORS para que nuestra API pueda ser consumida desde otros dominios
app.use(cors());

// Nos permite registrar las solicitudes que llegan a la aplicación "tiny" es un formato de registro
app.use(morgan("tiny"));

// Nos permite analizar el cuerpo de las solicitudes entrantes en formato JSON
app.use(express.json());

// Rutas
app.use("/tasks", taskRouter);

// Controlador de errores
app.use(errorHandler);

export default app;
