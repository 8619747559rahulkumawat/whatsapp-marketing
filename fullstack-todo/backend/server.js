import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import todoRoutes from "./routes/todoRoutes.js";

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/todoapp";

app.use(cors());
app.use(express.json());

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));

app.use("/api/todos", todoRoutes);

app.get("/", (req, res) => {
  res.send("Todo API is running");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
