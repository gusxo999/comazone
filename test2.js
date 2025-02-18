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
