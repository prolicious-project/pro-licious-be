import { Router, Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import { authMiddleware } from "../middleware/auth";
import { roleGuard } from "../middleware/roleGuard";
import { successResponse } from "../utils/responses";
import * as svc from "../services/customer.service";

const router = Router();
router.use(authMiddleware, roleGuard("CUSTOMER"));

const uid = (req: Request) => req.user!.id;

/** Customer routes — 22 endpoints */
router.get("/profile", asyncHandler(async (req, res) => successResponse(res, await svc.getProfile(uid(req)))));
router.patch("/profile", asyncHandler(async (req, res) => successResponse(res, await svc.updateProfile(uid(req), req.body))));
router.get("/addresses", asyncHandler(async (req, res) => successResponse(res, await svc.listAddresses(uid(req)))));
router.post("/addresses", asyncHandler(async (req, res) => successResponse(res, await svc.addAddress(uid(req), req.body), "Created", 201)));
router.patch("/addresses/:id", asyncHandler(async (req, res) => successResponse(res, await svc.updateAddress(uid(req), +req.params.id, req.body))));
router.delete("/addresses/:id", asyncHandler(async (req, res) => successResponse(res, await svc.deleteAddress(uid(req), +req.params.id))));
router.get("/vendors", asyncHandler(async (req, res) => successResponse(res, await svc.listVendors(req.query.zoneId ? +req.query.zoneId : undefined))));
router.get("/vendors/:id/menu", asyncHandler(async (req, res) => successResponse(res, await svc.getVendorMenu(+req.params.id))));
router.get("/vendors/:id", asyncHandler(async (req, res) => successResponse(res, await svc.getVendor(+req.params.id))));
router.get("/search", asyncHandler(async (req, res) => successResponse(res, await svc.search(String(req.query.query || "")))));
router.get("/categories", asyncHandler(async (_req, res) => successResponse(res, await svc.listCategories())));
router.get("/cart", asyncHandler(async (req, res) => successResponse(res, await svc.getCart(uid(req)))));
router.post("/cart/items", asyncHandler(async (req, res) => successResponse(res, await svc.addCartItem(uid(req), req.body), "Added", 201)));
router.patch("/cart/items/:id", asyncHandler(async (req, res) => successResponse(res, await svc.updateCartItem(uid(req), +req.params.id, req.body.quantity))));
router.delete("/cart/items/:id", asyncHandler(async (req, res) => successResponse(res, await svc.removeCartItem(uid(req), +req.params.id))));
router.delete("/cart", asyncHandler(async (req, res) => successResponse(res, await svc.clearCart(uid(req), req.query.vendorId ? +req.query.vendorId : undefined))));
router.post("/orders", asyncHandler(async (req, res) => successResponse(res, await svc.placeOrder(uid(req), req.body), "Order placed", 201)));
router.get("/orders", asyncHandler(async (req, res) => successResponse(res, await svc.listOrders(uid(req)))));
router.get("/orders/:id/tracking", asyncHandler(async (req, res) => successResponse(res, await svc.getOrderTracking(uid(req), +req.params.id))));
router.get("/orders/:id", asyncHandler(async (req, res) => successResponse(res, await svc.getOrder(uid(req), +req.params.id))));
router.post("/orders/:id/cancel", asyncHandler(async (req, res) => successResponse(res, await svc.cancelOrder(uid(req), +req.params.id))));
router.post("/payments/initiate", asyncHandler(async (req, res) => successResponse(res, await svc.initiatePayment(uid(req), req.body.orderId))));
router.post("/payments/verify", asyncHandler(async (req, res) => successResponse(res, await svc.verifyPayment(uid(req), req.body))));
router.post("/complaints", asyncHandler(async (req, res) => successResponse(res, await svc.createComplaint(uid(req), req.body), "Created", 201)));
router.get("/complaints", asyncHandler(async (req, res) => successResponse(res, await svc.listComplaints(uid(req)))));
router.post("/support/tickets", asyncHandler(async (req, res) => successResponse(res, await svc.createTicket(uid(req), req.body), "Created", 201)));
router.get("/notifications", asyncHandler(async (req, res) => successResponse(res, await svc.listNotifications(uid(req)))));
router.patch("/notifications/:id/read", asyncHandler(async (req, res) => successResponse(res, await svc.markNotificationRead(uid(req), +req.params.id))));
router.post("/favorites/:vendorId", asyncHandler(async (req, res) => successResponse(res, await svc.addFavorite(uid(req), +req.params.vendorId), "Added", 201)));
router.delete("/favorites/:vendorId", asyncHandler(async (req, res) => successResponse(res, await svc.removeFavorite(uid(req), +req.params.vendorId))));

export default router;
