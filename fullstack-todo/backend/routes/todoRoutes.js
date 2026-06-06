import express from "express";
import Todo from "../models/Todo.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const todos = await Todo.find().sort({ createdAt: -1 });
  res.json({ success: true, data: todos });
});

router.post("/", async (req, res) => {
  const todo = await Todo.create({
    title: req.body.title,
    completed: req.body.completed,
  });
  res.status(201).json({ success: true, data: todo });
});

router.patch("/:id", async (req, res) => {
  const todo = await Todo.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!todo) {
    return res.status(404).json({ success: false, message: "Todo not found" });
  }

  res.json({ success: true, data: todo });
});

router.delete("/:id", async (req, res) => {
  const todo = await Todo.findByIdAndDelete(req.params.id);

  if (!todo) {
    return res.status(404).json({ success: false, message: "Todo not found" });
  }

  res.json({ success: true, message: "Todo deleted" });
});

export default router;
