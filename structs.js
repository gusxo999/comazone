import * as s from "superstruct";
import isEmail from "is-email";
import { Category } from "@prisma/client";
import isuuid from "is-uuid";

const isuuidd = s.define("UUID", (value) => isuuid.v4(value));

export const CreateUser = s.object({
  email: s.define("Email", isEmail),
  firstName: s.size(s.string(), 1, 30),
  lastName: s.size(s.string(), 1, 30),
  address: s.string(),
  userPreference: s.object({
    receiveEmail: s.boolean(),
  }),
});

export const PathUser = s.partial(CreateUser);

export const CreateProduct = s.object({
  name: s.size(s.string(), 1, 60),
  description: s.string(),
  price: s.min(s.number(), 0),
  stock: s.min(s.integer(), 0),
  category: s.enums(Object.values(Category)),
});

export const PatchProduct = s.partial(CreateProduct);

export const CreateOrder = s.object({
  userId: isuuidd,
  orderedItems: s.size(
    s.array(
      s.object({
        productId: s.string(),
        quantity: s.min(s.integer(), 1),
        unitPrice: s.min(s.number(), 0),
      })
    ),
    1,
    Infinity
  ),
});

export const CreateOrderItem = s.object({
  orderId: isuuidd,
  productId: s.string(),
  quantity: s.min(s.integer(), 1),
  unitPrice: s.min(s.number(), 0),
});

export const CreateSavedProduct = s.object({
  productId: isuuidd,
});
