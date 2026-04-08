import request from "supertest";
import mongoose from "mongoose";
import "./mongoSetup";
import app from "../server";
import Task from "../models/Task";

// Eliminar las tareas para qu ela db siempre esta limpia
beforeEach(async () => {
  await Task.deleteMany({});
});

describe("Tasks Routes", () => {
  describe("GET /tasks", () => {
    // ✅ Verifica que cuando no hay tareas en la BD, se retorna un array vacío
    it("should return an empty array when no tasks exist", async () => {
      const response = await request(app).get("/tasks");

      expect(response.status).toBe(200);
      expect(response.body.tasks).toEqual([]);
    });

    // ✅ Verifica que retorna todas las tareas ordenadas por la más reciente primero
    it("should return all tasks", async () => {
      const task1 = await Task.create({
        name: "Task 1",
        description: "First task",
        completed: false,
      });
      const task2 = await Task.create({
        name: "Task 2",
        description: "Second task",
        completed: true,
      });

      const response = await request(app).get("/tasks");

      expect(response.status).toBe(200);
      expect(response.body.tasks).toHaveLength(2);
      expect(response.body.tasks[0]._id).toBeDefined();
      expect(response.body.tasks[0].name).toBe("Task 2"); // Sorted by newest first
      expect(response.body.tasks[1].name).toBe("Task 1");
    });

    // ✅ Verifica que la búsqueda por nombre funciona sin importar mayúsculas/minúsculas
    it("should filter tasks by name (case-insensitive)", async () => {
      await Task.create({
        name: "Complete Project Setup",
        description: "MongoDB setup",
        completed: false,
      });
      await Task.create({
        name: "Write API Tests",
        description: "Test coverage",
        completed: false,
      });

      const response = await request(app).get("/tasks?name=project");

      expect(response.status).toBe(200);
      expect(response.body.tasks).toHaveLength(1);
      expect(response.body.tasks[0].name).toBe("Complete Project Setup");
    });

    // ✅ Verifica que filtra las tareas por un rango de fechas de vencimiento (desde-hasta)
    it("should filter tasks by due date range", async () => {
      const dueDateInRange = new Date("2025-11-15");
      const dueDateOutOfRange = new Date("2025-12-25");

      await Task.create({
        name: "Task in range",
        dueDate: dueDateInRange,
        completed: false,
      });
      await Task.create({
        name: "Task out of range",
        dueDate: dueDateOutOfRange,
        completed: false,
      });

      const response = await request(app).get(
        "/tasks?dueDateFrom=2025-11-01T00:00:00Z&dueDateTo=2025-11-30T23:59:59Z",
      );

      expect(response.status).toBe(200);
      expect(response.body.tasks).toHaveLength(1);
      expect(response.body.tasks[0].name).toBe("Task in range");
    });

    // ✅ Verifica que combina múltiples filtros: por nombre Y por rango de fechas simultáneamente
    it("should filter tasks by name and date range", async () => {
      await Task.create({
        name: "Project Setup",
        dueDate: new Date("2025-11-15"),
        completed: false,
      });
      await Task.create({
        name: "API Tests",
        dueDate: new Date("2025-11-15"),
        completed: false,
      });
      await Task.create({
        name: "Project Review",
        dueDate: new Date("2025-12-15"),
        completed: false,
      });

      const response = await request(app).get(
        "/tasks?name=project&dueDateFrom=2025-11-01T00:00:00Z&dueDateTo=2025-11-30T23:59:59Z",
      );

      expect(response.status).toBe(200);
      expect(response.body.tasks).toHaveLength(1);
      expect(response.body.tasks[0].name).toBe("Project Setup");
    });
  });

  describe("GET /tasks/:id", () => {
    // ✅ Verifica que retorna una tarea específica cuando se proporciona su ID
    it("should return a task by ID", async () => {
      const task = await Task.create({
        name: "Test Task",
        description: "A test task",
        completed: false,
      });

      const response = await request(app).get(`/tasks/${task._id}`);

      expect(response.status).toBe(200);
      expect(response.body.task._id).toBe((task as any)._id.toString());
      expect(response.body.task.name).toBe("Test Task");
      expect(response.body.task.description).toBe("A test task");
      expect(response.body.task.completed).toBe(false);
    });

    // ❌ Verifica que retorna error 404 cuando se intenta obtener una tarea que no existe
    it("should return 404 when task does not exist", async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app).get(`/tasks/${fakeId}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Task not found");
    });

    // ❌ Verifica que retorna error 500 cuando se proporciona un ID con formato inválido
    it("should return 500 for invalid ObjectId", async () => {
      const response = await request(app).get("/tasks/invalid-id");

      expect(response.status).toBe(500);
    });
  });

  describe("POST /tasks", () => {
    // ✅ Verifica que crea una tarea con todos los campos completados
    it("should create a new task with all fields", async () => {
      const taskData = {
        name: "New Task",
        description: "Task description",
        dueDate: "2025-11-30T23:59:59Z",
        completed: false,
      };

      const response = await request(app).post("/tasks").send(taskData);

      expect(response.status).toBe(201);
      expect(response.body.task._id).toBeDefined();
      expect(response.body.task.name).toBe("New Task");
      expect(response.body.task.description).toBe("Task description");
      expect(response.body.task.completed).toBe(false);
      expect(response.body.task.createdAt).toBeDefined();
      expect(response.body.task.updatedAt).toBeDefined();

      const savedTask = await Task.findById(response.body.task._id);
      expect(savedTask).toBeDefined();
    });

    // ✅ Verifica que crea una tarea solo con el campo requerido (nombre)
    it("should create a task with only required fields", async () => {
      const taskData = {
        name: "Minimal Task",
      };

      const response = await request(app).post("/tasks").send(taskData);

      expect(response.status).toBe(201);
      expect(response.body.task.name).toBe("Minimal Task");
      expect(response.body.task.completed).toBe(false);
      expect(response.body.task.description).toBeUndefined();
    });

    // ❌ Verifica que retorna error 500 cuando se intenta crear una tarea sin el nombre (campo requerido)
    it("should return 500 when name is missing", async () => {
      const taskData = {
        description: "No name provided",
      };

      const response = await request(app).post("/tasks").send(taskData);

      expect(response.status).toBe(500);
    });

    // ❌ Verifica que rechaza un nombre de tarea que excede la longitud máxima (100 caracteres)
    it("should reject task name exceeding max length", async () => {
      const taskData = {
        name: "a".repeat(101), // Exceeds max length of 100
        description: "Test",
      };

      const response = await request(app).post("/tasks").send(taskData);

      expect(response.status).toBe(500);
    });
  });

  describe("PUT /tasks/:id", () => {
    // ✅ Verifica que actualiza todos los campos de una tarea existente
    it("should update a task with all fields", async () => {
      const task = await Task.create({
        name: "Original Task",
        description: "Original description",
        completed: false,
      });

      const updateData = {
        name: "Updated Task",
        description: "Updated description",
        dueDate: "2025-11-30T23:59:59Z",
        completed: true,
      };

      const response = await request(app)
        .put(`/tasks/${task._id}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.task._id).toBe((task as any)._id.toString());
      expect(response.body.task.name).toBe("Updated Task");
      expect(response.body.task.description).toBe("Updated description");
      expect(response.body.task.completed).toBe(true);

      const updatedTask = await Task.findById(task._id);
      expect(updatedTask?.name).toBe("Updated Task");
      expect(updatedTask?.completed).toBe(true);
    });

    // ✅ Verifica que actualiza solo algunos campos sin afectar los demás
    it("should update only specific fields", async () => {
      const task = await Task.create({
        name: "Original Task",
        description: "Original description",
        completed: false,
      });

      const updateData = {
        name: "Updated Name",
        description: "Original description", // Keep same
        completed: false, // Keep same
      };

      const response = await request(app)
        .put(`/tasks/${task._id}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.task.name).toBe("Updated Name");
    });

    // ❌ Verifica que retorna error 404 cuando se intenta actualizar una tarea que no existe
    it("should return 404 when task does not exist", async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .put(`/tasks/${fakeId}`)
        .send({ name: "Updated" });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Task not found");
    });

    // ❌ Verifica que valida los datos al actualizar (ejemplo: rechaza nombre > 100 caracteres)
    it("should validate updated data", async () => {
      const task = await Task.create({
        name: "Original Task",
        completed: false,
      });

      const updateData = {
        name: "a".repeat(101), // Exceeds max length
        description: "Test",
        completed: false,
      };

      const response = await request(app)
        .put(`/tasks/${task._id}`)
        .send(updateData);

      expect(response.status).toBe(500);
    });
  });

  describe("DELETE /tasks/:id", () => {
    // ✅ Verifica que elimina una tarea de la base de datos
    it("should delete a task", async () => {
      const task = await Task.create({
        name: "Task to delete",
        completed: false,
      });

      const response = await request(app).delete(`/tasks/${task._id}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Task deleted successfully");

      const deletedTask = await Task.findById(task._id);
      expect(deletedTask).toBeNull();
    });

    // ❌ Verifica que retorna error 404 cuando se intenta eliminar una tarea que no existe
    it("should return 404 when task does not exist", async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app).delete(`/tasks/${fakeId}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Task not found");
    });

    // ❌ Verifica que retorna error 500 cuando se proporciona un ID con formato inválido para eliminar
    it("should return 500 for invalid ObjectId", async () => {
      const response = await request(app).delete("/tasks/invalid-id");

      expect(response.status).toBe(500);
    });
  });
});
