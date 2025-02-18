app.post("/orders", async (req, res) => {
  const { userId, orderItems } = req.body;

  //1. get products
  const productIds = orderItems.map((item) => item.productId);
  const products = await prisma.product.findMany({
    where: {
      id: {
        in: orderItems.map((item) => item.productId),
      },
    },
  });

  function getQuantity(productId) {
    return orderItems.find((item) => item.productId === productId).quantity;
  }

  //2. 재고와 주문량 확인
  const isSuffcientStock = products.every((product) => {
    const quantity = getQuantity(product.id);
    return product.stock >= quantity;
  });

  //3. error or create order
  if (!isSuffcientStock) {
    res.status(400).send("Insufficient stock");
    return;
  }

  //4. 재고감소 시키기
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
