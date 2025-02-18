import express from "express";
import cors from "cors";
import { Prisma, PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import { assert, func } from "superstruct";
import {
  CreateUser,
  PathUser,
  CreateProduct,
  PatchProduct,
} from "./structs.js";

dotenv.config();

const prisma = new PrismaClient();

const app = express();
app.use(cors());
app.use(express.json());

function handleErrors(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (error) {
      console.error(error);
      console.log(error);
      res.status(500).send("Something went wrong");
    }
  };
}

app.get("/users", async (req, res) => {
  const { offset = 0, limit = 10, order = "newest" } = req.query;

  let orderBy;
  switch (order) {
    case "oldest":
      orderBy = {
        createdAt: "asc",
      };
      break;
    case "newest":
      orderBy = {
        createdAt: "desc",
      };
      break;
    default:
      orderBy = {
        createdAt: "desc",
      };
  }
  const users = await prisma.user.findMany({
    skip: Number(offset),
    take: Number(limit),
    orderBy,
    include: {
      userPreference: {
        select: {
          receiveEmail: true,
        },
      },
    },
    select: {
      id: true,
      email: true,
    },
  });
  res.json(users);
});

app.get("/users/:id", async (req, res) => {
  const { id } = req.params;
  const user = await prisma.user.findUniqueOrThrow({
    where: { id },
  });
  res.json(user);
});

app.get("/users/:id/saved-products", async (req, res) => {
  const { id } = req.params;
  const { savedProducts } = await prisma.user.findUniqueOrThrow({
    where: { id },
    include: {
      savedProducts: true,
    },
  });
  res.json(savedProducts);
});

app.post("/users/:id/saved-products", async (req, res) => {
  const { id: userId } = req.params;
  const { productId } = req.body;

  const savedCount = await prisma.user.count({
    where: {
      id: userId,
      savedProducts: {
        some: {
          id: productId,
        },
      },
    },
  });

  const condition =
    savedCount > 0
      ? { disconnect: { id: productId } }
      : { connect: { id: productId } };

  const { savedProducts } = await prisma.user.update({
    where: { id: userId },
    data: {
      savedProducts: condition,
    },
    include: {
      savedProducts: true,
    },
  });
  res.json(savedProducts);
});

app.post("/users", async (req, res) => {
  assert(req.body, CreateUser);
  const { userPreference, ...userFields } = req.body;
  const user = await prisma.user.create({
    data: {
      ...userFields,
      userPreference: {
        create: userPreference,
      },
    },
    include: {
      userPreference: true,
    },
  });
  res.status(201).send(user);
});

app.patch("/users/:id", async (req, res) => {
  assert(req.body, PathUser);
  const { id } = req.params;
  const { firstName, lastName, email, address } = req.body;

  const user = await prisma.user.update({
    where: { id },
    data: {
      firstName,
      lastName,
      email,
      address,
    },
  });
  res.json(user);
});

app.delete("/users/:id", async (req, res) => {
  const { id } = req.params;
  await prisma.user.delete({
    where: { id },
  });
  res.sendStatus(204).send(`User with id ${id} deleted`);
});

//PRODUCT

app.get("/products", async (req, res) => {
  const { offset = 0, limit = 10, order = "newest", category } = req.query;

  let orderBy;
  switch (order) {
    case "oldest":
      orderBy = {
        createdAt: "asc",
      };
      break;
    case "newest":
      orderBy = {
        createdAt: "desc",
      };
      break;
    case "priceLowest":
      orderBy = {
        price: "asc",
      };
      break;
    case "priceHighest":
      orderBy = {
        price: "desc",
      };
      break;
    default:
      orderBy = {
        createdAt: "desc",
      };
  }

  const where = category ? { category } : {};

  const products = await prisma.product.findMany({
    skip: Number(offset),
    take: Number(limit),
    orderBy,
    where,
  });
  res.json(products);
});

app.get("/products/:id", async (req, res) => {
  const { id } = req.params;
  const products = await prisma.product.findUnique({
    where: { id },
  });
  res.json(products);
});

app.post("/products", async (req, res) => {
  assert(req.body, CreateProduct);
  const product = await prisma.product.create({
    data: req.body,
  });
  res.status(201).send(product);
});

app.patch("/products/:id", async (req, res) => {
  assert(req.body, PatchProduct);
  const { id } = req.params;
  const { name, price } = req.body;

  const product = await prisma.product.update({
    where: { id },
    data: {
      name,
      price,
    },
  });
  res.json(product);
});

app.delete("/products/:id", async (req, res) => {
  const { id } = req.params;
  await prisma.product.delete({
    where: { id },
  });
  res.sendStatus(204);
});

//ORDERS
app.get("/orders/:id", async (req, res) => {
  const { id } = req.params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      Ordereditems: true,
    },
  });

  let totalPrice = 0;
  order.Ordereditems.forEach(({ unitPrice, quantity }) => {
    totalPrice += quantity * unitPrice;
  });
  order.totalPrice = totalPrice;
  res.json(order);
});

//user orders
app.get("/users/:id/orders", async (req, res) => {
  const { id } = req.params;
  const orders = await prisma.order.findMany({
    where: { userId: id },
  });
  res.json(orders);
});

// const items = orderItems.map((item) => ({
//   ...item,
//   product: {
//     connect: {
//       id: item.productId,
//     },
//   },
// }));

app.post("/orders", async (req, res) => {
  const { userId, orderItems } = req.body;

  const productIds = orderItems.map((item) => item.productId);
  const products = await prisma.product.findMany({
    where: {
      id: {
        in: productIds,
      },
    },
  });

  function getQuantity(productId) {
    return orderItems.find((item) => item.productId === productId).quantity;
  }

  const isSufficientStock = products.every((product) => {
    const quantity = getQuantity(product.id);
    return product.stock >= quantity;
  });

  if (!isSufficientStock) {
    res.status(400).send("Insufficient stock");
    return;
  }

  try {
    await prisma.$transaction(async (prisma) => {
      const updateStock = products.map((product) => {
        const quantity = getQuantity(product.id);
        return prisma.product.update({
          where: { id: product.id },
          data: {
            stock: {
              decrement: quantity,
            },
          },
        });
      });

      await Promise.all(updateStock);

      const order = await prisma.order.create({
        data: {
          user: {
            connect: {
              id: userId,
            },
          },
          Ordereditems: {
            create: orderItems,
          },
        },
      });

      res.status(201).send(order);
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Something went wrong");
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on http://localhost:${process.env.PORT}`);
});
