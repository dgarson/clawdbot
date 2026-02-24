import React, { useState } from "react";
import { Inbox, Users } from "lucide-react";
import { cn } from "../lib/utils";
import { ContextualEmptyState } from "../components/ui/ContextualEmptyState";

// ─── Types ───────────────────────────────────────────────────────────────────

type QueueType = "fifo" | "priority" | "delay";
type ConsumerStatus = "active" | "idle" | "draining";
type TrajectoryStatus = "received" | "processing" | "delivered" | "failed";
type RetryResult = "success" | "failed";
type TabId = "queues" | "messages" | "deadletter" | "metrics";

interface Queue {
  id: string;
  name: string;
  type: QueueType;
  depth: number;
  consumers: number;
  throughputPerSec: number;
  oldestMessageAge: string;
  dlqDepth: number;
  visibilityTimeout: number;
  maxReceiveCount: number;
  messageRetentionPeriod: number;
  deliveryDelay: number;
  throughputHistory: number[];
}

interface Consumer {
  id: string;
  queueId: string;
  host: string;
  messagesPerSec: number;
  status: ConsumerStatus;
  lastHeartbeat: string;
}

interface TrajectoryStep {
  status: TrajectoryStatus;
  timestamp: string;
  detail: string;
}

interface RetryEntry {
  attempt: number;
  timestamp: string;
  result: RetryResult;
  error?: string;
}

interface Message {
  id: string;
  queueId: string;
  bodyPreview: string;
  body: string;
  receiveCount: number;
  firstReceiveTimestamp: string;
  sendTimestamp: string;
  attributes: Record<string, string>;
  trajectory: TrajectoryStep[];
  retryHistory: RetryEntry[];
}

interface DLQEntry {
  id: string;
  originalQueueId: string;
  originalQueueName: string;
  messageId: string;
  failureReason: string;
  receiveCount: number;
  firstSentTimestamp: string;
  body: string;
  attributes: Record<string, string>;
}

interface MetricPoint {
  time: string;
  messagesIn: number;
  messagesOut: number;
  errorRate: number;
  consumerLag: number;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const QUEUES: Queue[] = [
  {
    id: "q1",
    name: "orders.processing",
    type: "fifo",
    depth: 1247,
    consumers: 8,
    throughputPerSec: 42.3,
    oldestMessageAge: "2m 14s",
    dlqDepth: 3,
    visibilityTimeout: 30,
    maxReceiveCount: 5,
    messageRetentionPeriod: 345600,
    deliveryDelay: 0,
    throughputHistory: [38, 41, 45, 43, 39, 42, 44, 47, 41, 40, 42, 43],
  },
  {
    id: "q2",
    name: "notifications.email",
    type: "fifo",
    depth: 534,
    consumers: 4,
    throughputPerSec: 18.7,
    oldestMessageAge: "45s",
    dlqDepth: 1,
    visibilityTimeout: 60,
    maxReceiveCount: 3,
    messageRetentionPeriod: 86400,
    deliveryDelay: 0,
    throughputHistory: [15, 17, 19, 18, 20, 19, 17, 18, 19, 20, 18, 19],
  },
  {
    id: "q3",
    name: "payments.webhook",
    type: "priority",
    depth: 89,
    consumers: 6,
    throughputPerSec: 8.1,
    oldestMessageAge: "12s",
    dlqDepth: 0,
    visibilityTimeout: 45,
    maxReceiveCount: 10,
    messageRetentionPeriod: 604800,
    deliveryDelay: 0,
    throughputHistory: [7, 8, 9, 8, 7, 8, 9, 8, 7, 8, 8, 8],
  },
  {
    id: "q4",
    name: "analytics.events",
    type: "fifo",
    depth: 8932,
    consumers: 12,
    throughputPerSec: 156.4,
    oldestMessageAge: "1m 02s",
    dlqDepth: 0,
    visibilityTimeout: 20,
    maxReceiveCount: 3,
    messageRetentionPeriod: 172800,
    deliveryDelay: 0,
    throughputHistory: [145, 150, 158, 162, 155, 157, 160, 159, 154, 156, 158, 156],
  },
  {
    id: "q5",
    name: "inventory.sync",
    type: "delay",
    depth: 324,
    consumers: 3,
    throughputPerSec: 5.2,
    oldestMessageAge: "8m 33s",
    dlqDepth: 0,
    visibilityTimeout: 120,
    maxReceiveCount: 5,
    messageRetentionPeriod: 259200,
    deliveryDelay: 300,
    throughputHistory: [4, 5, 5, 6, 5, 5, 4, 5, 5, 6, 5, 5],
  },
  {
    id: "q6",
    name: "reports.generation",
    type: "delay",
    depth: 12,
    consumers: 2,
    throughputPerSec: 0.8,
    oldestMessageAge: "34m 17s",
    dlqDepth: 0,
    visibilityTimeout: 300,
    maxReceiveCount: 3,
    messageRetentionPeriod: 86400,
    deliveryDelay: 600,
    throughputHistory: [1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0],
  },
  {
    id: "q7",
    name: "users.events",
    type: "fifo",
    depth: 2103,
    consumers: 5,
    throughputPerSec: 28.9,
    oldestMessageAge: "3m 41s",
    dlqDepth: 0,
    visibilityTimeout: 30,
    maxReceiveCount: 5,
    messageRetentionPeriod: 259200,
    deliveryDelay: 0,
    throughputHistory: [25, 27, 29, 31, 28, 30, 29, 28, 29, 30, 29, 29],
  },
];

const CONSUMERS: Consumer[] = [
  { id: "c1",  queueId: "q1", host: "worker-01.prod",    messagesPerSec: 6.2, status: "active",   lastHeartbeat: "2s ago" },
  { id: "c2",  queueId: "q1", host: "worker-02.prod",    messagesPerSec: 5.8, status: "active",   lastHeartbeat: "1s ago" },
  { id: "c3",  queueId: "q1", host: "worker-03.prod",    messagesPerSec: 6.1, status: "active",   lastHeartbeat: "3s ago" },
  { id: "c4",  queueId: "q1", host: "worker-04.prod",    messagesPerSec: 5.9, status: "idle",     lastHeartbeat: "4s ago" },
  { id: "c5",  queueId: "q1", host: "worker-05.prod",    messagesPerSec: 6.3, status: "active",   lastHeartbeat: "1s ago" },
  { id: "c6",  queueId: "q1", host: "worker-06.prod",    messagesPerSec: 0.0, status: "draining", lastHeartbeat: "12s ago" },
  { id: "c7",  queueId: "q1", host: "worker-07.prod",    messagesPerSec: 5.7, status: "active",   lastHeartbeat: "2s ago" },
  { id: "c8",  queueId: "q1", host: "worker-08.prod",    messagesPerSec: 6.3, status: "active",   lastHeartbeat: "2s ago" },
  { id: "c9",  queueId: "q2", host: "notif-01.prod",     messagesPerSec: 4.8, status: "active",   lastHeartbeat: "1s ago" },
  { id: "c10", queueId: "q2", host: "notif-02.prod",     messagesPerSec: 4.6, status: "active",   lastHeartbeat: "3s ago" },
  { id: "c11", queueId: "q2", host: "notif-03.prod",     messagesPerSec: 4.7, status: "active",   lastHeartbeat: "2s ago" },
  { id: "c12", queueId: "q2", host: "notif-04.prod",     messagesPerSec: 4.6, status: "idle",     lastHeartbeat: "5s ago" },
  { id: "c13", queueId: "q3", host: "pay-01.prod",       messagesPerSec: 1.4, status: "active",   lastHeartbeat: "1s ago" },
  { id: "c14", queueId: "q3", host: "pay-02.prod",       messagesPerSec: 1.3, status: "active",   lastHeartbeat: "2s ago" },
  { id: "c15", queueId: "q3", host: "pay-03.prod",       messagesPerSec: 1.4, status: "active",   lastHeartbeat: "1s ago" },
  { id: "c16", queueId: "q4", host: "analytics-01.prod", messagesPerSec: 13.2, status: "active",  lastHeartbeat: "1s ago" },
  { id: "c17", queueId: "q4", host: "analytics-02.prod", messagesPerSec: 12.9, status: "active",  lastHeartbeat: "2s ago" },
  { id: "c18", queueId: "q5", host: "inv-01.prod",       messagesPerSec: 1.8, status: "active",   lastHeartbeat: "2s ago" },
  { id: "c19", queueId: "q6", host: "rpt-01.prod",       messagesPerSec: 0.4, status: "idle",     lastHeartbeat: "8s ago" },
  { id: "c20", queueId: "q7", host: "usr-01.prod",       messagesPerSec: 5.9, status: "active",   lastHeartbeat: "1s ago" },
];

const MESSAGES: Message[] = [
  {
    id: "msg-7f4a1b2c",
    queueId: "q1",
    bodyPreview: '{"orderId":"ORD-48291","customerId":"CUST-1029","total":249.99}',
    body: JSON.stringify({ orderId: "ORD-48291", customerId: "CUST-1029", total: 249.99, items: [{ sku: "ITEM-001", qty: 2, price: 99.99 }, { sku: "ITEM-007", qty: 1, price: 50.01 }], shippingAddress: { street: "123 Main St", city: "Denver", state: "CO", zip: "80201" } }, null, 2),
    receiveCount: 1,
    firstReceiveTimestamp: "2026-02-22T06:10:14Z",
    sendTimestamp: "2026-02-22T06:10:12Z",
    attributes: { MessageGroupId: "orders", ApproximateFirstReceiveTimestamp: "1740204614000", SenderId: "AIDAEXAMPLE123" },
    trajectory: [
      { status: "received",   timestamp: "2026-02-22T06:10:12Z", detail: "Message enqueued from orders-service" },
      { status: "processing", timestamp: "2026-02-22T06:10:14Z", detail: "Picked up by worker-01.prod" },
    ],
    retryHistory: [],
  },
  {
    id: "msg-3e8d9a4f",
    queueId: "q1",
    bodyPreview: '{"orderId":"ORD-48290","customerId":"CUST-8847","total":74.50}',
    body: JSON.stringify({ orderId: "ORD-48290", customerId: "CUST-8847", total: 74.50, items: [{ sku: "ITEM-012", qty: 1, price: 74.50 }], shippingAddress: { street: "456 Oak Ave", city: "Boulder", state: "CO", zip: "80301" } }, null, 2),
    receiveCount: 2,
    firstReceiveTimestamp: "2026-02-22T06:08:42Z",
    sendTimestamp: "2026-02-22T06:08:40Z",
    attributes: { MessageGroupId: "orders", ApproximateFirstReceiveTimestamp: "1740204522000", SenderId: "AIDAEXAMPLE123" },
    trajectory: [
      { status: "received",   timestamp: "2026-02-22T06:08:40Z", detail: "Message enqueued from orders-service" },
      { status: "processing", timestamp: "2026-02-22T06:08:42Z", detail: "Picked up by worker-03.prod" },
      { status: "failed",     timestamp: "2026-02-22T06:08:72Z", detail: "Inventory check timeout — retrying" },
      { status: "processing", timestamp: "2026-02-22T06:09:12Z", detail: "Retry — picked up by worker-02.prod" },
    ],
    retryHistory: [
      { attempt: 1, timestamp: "2026-02-22T06:08:42Z", result: "failed",  error: "Inventory service timeout after 30s" },
      { attempt: 2, timestamp: "2026-02-22T06:09:12Z", result: "success" },
    ],
  },
  {
    id: "msg-1c5b7e2a",
    queueId: "q2",
    bodyPreview: '{"type":"welcome","userId":"USR-9921","email":"alex@example.com"}',
    body: JSON.stringify({ type: "welcome", userId: "USR-9921", email: "alex@example.com", template: "welcome-v3", locale: "en-US", variables: { firstName: "Alex", planName: "Pro" } }, null, 2),
    receiveCount: 1,
    firstReceiveTimestamp: "2026-02-22T06:13:55Z",
    sendTimestamp: "2026-02-22T06:13:53Z",
    attributes: { MessageGroupId: "email", ContentType: "application/json", Priority: "normal" },
    trajectory: [
      { status: "received",   timestamp: "2026-02-22T06:13:53Z", detail: "Enqueued from user-registration-service" },
      { status: "processing", timestamp: "2026-02-22T06:13:55Z", detail: "Picked up by notif-01.prod" },
      { status: "delivered",  timestamp: "2026-02-22T06:13:58Z", detail: "Email delivered via SendGrid" },
    ],
    retryHistory: [],
  },
  {
    id: "msg-8a2f3d1e",
    queueId: "q2",
    bodyPreview: '{"type":"password_reset","userId":"USR-4417","email":"bob@example.com"}',
    body: JSON.stringify({ type: "password_reset", userId: "USR-4417", email: "bob@example.com", template: "password-reset-v2", resetToken: "tok_8f2a1b3c4d5e6f7a", expiresAt: "2026-02-22T07:13:00Z" }, null, 2),
    receiveCount: 1,
    firstReceiveTimestamp: "2026-02-22T06:12:01Z",
    sendTimestamp: "2026-02-22T06:12:00Z",
    attributes: { MessageGroupId: "email", ContentType: "application/json", Priority: "high" },
    trajectory: [
      { status: "received",   timestamp: "2026-02-22T06:12:00Z", detail: "Enqueued from auth-service" },
      { status: "processing", timestamp: "2026-02-22T06:12:01Z", detail: "Picked up by notif-02.prod" },
      { status: "delivered",  timestamp: "2026-02-22T06:12:03Z", detail: "Email delivered via SendGrid" },
    ],
    retryHistory: [],
  },
  {
    id: "msg-9d4c8b1f",
    queueId: "q3",
    bodyPreview: '{"event":"payment.completed","paymentId":"PAY-77231","amount":1299.00}',
    body: JSON.stringify({ event: "payment.completed", paymentId: "PAY-77231", amount: 1299.00, currency: "USD", customerId: "CUST-5523", orderId: "ORD-48285", processor: "stripe", processorId: "ch_3PQR1234567890" }, null, 2),
    receiveCount: 1,
    firstReceiveTimestamp: "2026-02-22T06:14:02Z",
    sendTimestamp: "2026-02-22T06:14:01Z",
    attributes: { Priority: "1", ContentType: "application/json", CorrelationId: "corr-99284" },
    trajectory: [
      { status: "received",   timestamp: "2026-02-22T06:14:01Z", detail: "Enqueued from payment-processor" },
      { status: "processing", timestamp: "2026-02-22T06:14:02Z", detail: "Picked up by pay-01.prod" },
    ],
    retryHistory: [],
  },
  {
    id: "msg-2b7e4c9d",
    queueId: "q4",
    bodyPreview: '{"event":"page_view","userId":"USR-3381","page":"/dashboard"}',
    body: JSON.stringify({ event: "page_view", userId: "USR-3381", sessionId: "sess-abc123", page: "/dashboard", referrer: "/login", timestamp: "2026-02-22T06:14:10Z", userAgent: "Mozilla/5.0", ip: "203.0.113.0" }, null, 2),
    receiveCount: 1,
    firstReceiveTimestamp: "2026-02-22T06:14:10Z",
    sendTimestamp: "2026-02-22T06:14:10Z",
    attributes: { MessageGroupId: "pageviews", ContentType: "application/json" },
    trajectory: [
      { status: "received",   timestamp: "2026-02-22T06:14:10Z", detail: "Enqueued from web-frontend" },
      { status: "processing", timestamp: "2026-02-22T06:14:10Z", detail: "Picked up by analytics-01.prod" },
      { status: "delivered",  timestamp: "2026-02-22T06:14:11Z", detail: "Written to analytics warehouse" },
    ],
    retryHistory: [],
  },
  {
    id: "msg-5f1a3d8e",
    queueId: "q5",
    bodyPreview: '{"action":"sync","productId":"PROD-8821","warehouseId":"WH-03"}',
    body: JSON.stringify({ action: "sync", productId: "PROD-8821", warehouseId: "WH-03", expectedQty: 450, currentQty: 448, threshold: 100, priority: "normal" }, null, 2),
    receiveCount: 1,
    firstReceiveTimestamp: "2026-02-22T06:08:00Z",
    sendTimestamp: "2026-02-22T06:03:00Z",
    attributes: { DelaySeconds: "300", ContentType: "application/json" },
    trajectory: [
      { status: "received",   timestamp: "2026-02-22T06:03:00Z", detail: "Enqueued from inventory-manager" },
      { status: "processing", timestamp: "2026-02-22T06:08:00Z", detail: "Delay expired — picked up by inv-01.prod" },
    ],
    retryHistory: [],
  },
  {
    id: "msg-4d2c6a7b",
    queueId: "q1",
    bodyPreview: '{"orderId":"ORD-48289","customerId":"CUST-3312","total":519.97}',
    body: JSON.stringify({ orderId: "ORD-48289", customerId: "CUST-3312", total: 519.97, items: [{ sku: "ITEM-023", qty: 3, price: 173.32 }], shippingAddress: { street: "789 Pine Rd", city: "Fort Collins", state: "CO", zip: "80521" } }, null, 2),
    receiveCount: 1,
    firstReceiveTimestamp: "2026-02-22T06:11:30Z",
    sendTimestamp: "2026-02-22T06:11:28Z",
    attributes: { MessageGroupId: "orders", ApproximateFirstReceiveTimestamp: "1740204690000", SenderId: "AIDAEXAMPLE123" },
    trajectory: [
      { status: "received",   timestamp: "2026-02-22T06:11:28Z", detail: "Message enqueued from orders-service" },
      { status: "processing", timestamp: "2026-02-22T06:11:30Z", detail: "Picked up by worker-05.prod" },
      { status: "delivered",  timestamp: "2026-02-22T06:11:35Z", detail: "Order processed successfully" },
    ],
    retryHistory: [],
  },
  {
    id: "msg-6e8b1f4c",
    queueId: "q7",
    bodyPreview: '{"event":"user.signup","userId":"USR-9944","plan":"starter"}',
    body: JSON.stringify({ event: "user.signup", userId: "USR-9944", email: "charlie@example.com", plan: "starter", referralCode: "REF-2281", utmSource: "google", utmCampaign: "spring-2026" }, null, 2),
    receiveCount: 1,
    firstReceiveTimestamp: "2026-02-22T06:14:05Z",
    sendTimestamp: "2026-02-22T06:14:04Z",
    attributes: { MessageGroupId: "user-lifecycle", ContentType: "application/json" },
    trajectory: [
      { status: "received",   timestamp: "2026-02-22T06:14:04Z", detail: "Enqueued from auth-service" },
      { status: "processing", timestamp: "2026-02-22T06:14:05Z", detail: "Picked up by usr-01.prod" },
    ],
    retryHistory: [],
  },
  {
    id: "msg-0a9c2e5f",
    queueId: "q6",
    bodyPreview: '{"reportType":"monthly_revenue","orgId":"ORG-112","period":"2026-01"}',
    body: JSON.stringify({ reportType: "monthly_revenue", orgId: "ORG-112", period: "2026-01", requestedBy: "USR-0042", format: "pdf", emailRecipients: ["cfo@example.com", "ceo@example.com"] }, null, 2),
    receiveCount: 1,
    firstReceiveTimestamp: "2026-02-22T05:40:00Z",
    sendTimestamp: "2026-02-22T05:30:00Z",
    attributes: { DelaySeconds: "600", ContentType: "application/json" },
    trajectory: [
      { status: "received",   timestamp: "2026-02-22T05:30:00Z", detail: "Enqueued from reporting-service" },
      { status: "processing", timestamp: "2026-02-22T05:40:00Z", detail: "Delay expired — picked up by rpt-01.prod" },
      { status: "delivered",  timestamp: "2026-02-22T05:52:14Z", detail: "Report generated and emailed" },
    ],
    retryHistory: [],
  },
  {
    id: "msg-b3d5f7a1",
    queueId: "q4",
    bodyPreview: '{"event":"button_click","userId":"USR-7712","element":"upgrade-cta"}',
    body: JSON.stringify({ event: "button_click", userId: "USR-7712", sessionId: "sess-xyz789", element: "upgrade-cta", page: "/pricing", timestamp: "2026-02-22T06:14:08Z" }, null, 2),
    receiveCount: 1,
    firstReceiveTimestamp: "2026-02-22T06:14:08Z",
    sendTimestamp: "2026-02-22T06:14:08Z",
    attributes: { MessageGroupId: "interactions", ContentType: "application/json" },
    trajectory: [
      { status: "received",   timestamp: "2026-02-22T06:14:08Z", detail: "Enqueued from web-frontend" },
      { status: "processing", timestamp: "2026-02-22T06:14:08Z", detail: "Picked up by analytics-02.prod" },
      { status: "delivered",  timestamp: "2026-02-22T06:14:09Z", detail: "Written to analytics warehouse" },
    ],
    retryHistory: [],
  },
];

const DLQ_ENTRIES: DLQEntry[] = [
  {
    id: "dlq-e1a2b3c4",
    originalQueueId: "q1",
    originalQueueName: "orders.processing",
    messageId: "msg-dead-9f1a",
    failureReason: "Payment gateway timeout — max receive count exceeded",
    receiveCount: 5,
    firstSentTimestamp: "2026-02-22T05:48:00Z",
    body: JSON.stringify({ orderId: "ORD-48251", customerId: "CUST-7714", total: 329.99, items: [{ sku: "ITEM-009", qty: 2, price: 164.99 }] }, null, 2),
    attributes: { MessageGroupId: "orders", OriginalQueueArn: "arn:aws:sqs:us-east-1:123456789:orders.processing", DeadLetterSourceQueue: "orders.processing" },
  },
  {
    id: "dlq-f5d6e7a8",
    originalQueueId: "q1",
    originalQueueName: "orders.processing",
    messageId: "msg-dead-2c3d",
    failureReason: "Inventory service unavailable — all 5 retries exhausted",
    receiveCount: 5,
    firstSentTimestamp: "2026-02-22T04:22:00Z",
    body: JSON.stringify({ orderId: "ORD-48197", customerId: "CUST-2244", total: 89.95, items: [{ sku: "ITEM-031", qty: 1, price: 89.95 }] }, null, 2),
    attributes: { MessageGroupId: "orders", OriginalQueueArn: "arn:aws:sqs:us-east-1:123456789:orders.processing", DeadLetterSourceQueue: "orders.processing" },
  },
  {
    id: "dlq-b9c0d1e2",
    originalQueueId: "q2",
    originalQueueName: "notifications.email",
    messageId: "msg-dead-4e5f",
    failureReason: "Invalid email address — validation failed on all 3 attempts",
    receiveCount: 3,
    firstSentTimestamp: "2026-02-22T03:15:00Z",
    body: JSON.stringify({ type: "promo", userId: "USR-8812", email: "invalid@@broken.com", template: "promo-spring-2026" }, null, 2),
    attributes: { MessageGroupId: "email", ContentType: "application/json", DeadLetterSourceQueue: "notifications.email" },
  },
  {
    id: "dlq-a3b4c5d6",
    originalQueueId: "q1",
    originalQueueName: "orders.processing",
    messageId: "msg-dead-6g7h",
    failureReason: "Malformed payload — schema validation error on all attempts",
    receiveCount: 5,
    firstSentTimestamp: "2026-02-22T02:50:00Z",
    body: '{"orderId":"ORD-48103","customerId":null,"total":-1,"items":[]}',
    attributes: { MessageGroupId: "orders", DeadLetterSourceQueue: "orders.processing", ValidationError: "customerId required, total must be positive" },
  },
];

const METRICS: MetricPoint[] = [
  { time: "06:00", messagesIn: 142, messagesOut: 139, errorRate: 0.8, consumerLag: 312 },
  { time: "06:05", messagesIn: 158, messagesOut: 155, errorRate: 0.6, consumerLag: 298 },
  { time: "06:10", messagesIn: 171, messagesOut: 168, errorRate: 1.1, consumerLag: 334 },
  { time: "06:15", messagesIn: 165, messagesOut: 162, errorRate: 0.9, consumerLag: 318 },
  { time: "06:20", messagesIn: 179, messagesOut: 175, errorRate: 0.7, consumerLag: 305 },
  { time: "06:25", messagesIn: 188, messagesOut: 184, errorRate: 1.4, consumerLag: 341 },
  { time: "06:30", messagesIn: 193, messagesOut: 189, errorRate: 0.8, consumerLag: 328 },
  { time: "06:35", messagesIn: 201, messagesOut: 196, errorRate: 0.6, consumerLag: 312 },
  { time: "06:40", messagesIn: 214, messagesOut: 210, errorRate: 0.9, consumerLag: 321 },
  { time: "06:45", messagesIn: 198, messagesOut: 194, errorRate: 1.2, consumerLag: 345 },
  { time: "06:50", messagesIn: 207, messagesOut: 202, errorRate: 0.7, consumerLag: 318 },
  { time: "06:55", messagesIn: 219, messagesOut: 215, errorRate: 0.5, consumerLag: 302 },
];

// ─── Utility Helpers ──────────────────────────────────────────────────────────

function formatDepth(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

function formatSeconds(s: number): string {
  if (s >= 86400) return Math.floor(s / 86400) + "d";
  if (s >= 3600)  return Math.floor(s / 3600)  + "h";
  if (s >= 60)    return Math.floor(s / 60)    + "m";
  return s + "s";
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + "…";
}

// ─── Small UI Atoms ───────────────────────────────────────────────────────────

function QueueTypeBadge({ type }: { type: QueueType }) {
  const cls =
    type === "fifo"     ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" :
    type === "priority" ? "bg-amber-400/20 text-amber-400 border-amber-400/30"   :
                          "bg-zinc-700/60 text-zinc-400 border-zinc-600/50";
  return (
    <span className={cn("px-1.5 py-0.5 text-xs rounded border font-mono uppercase tracking-wide", cls)}>
      {type}
    </span>
  );
}

function StatusDot({ status }: { status: ConsumerStatus }) {
  const cls =
    status === "active"   ? "bg-emerald-400" :
    status === "idle"     ? "bg-zinc-500"    :
                            "bg-amber-400";
  return <span className={cn("inline-block w-2 h-2 rounded-full shrink-0", cls)} />;
}

function TrajectoryBadge({ status }: { status: TrajectoryStatus }) {
  const cls =
    status === "delivered"  ? "bg-emerald-400/20 text-emerald-400 border-emerald-400/30" :
    status === "failed"     ? "bg-rose-400/20 text-rose-400 border-rose-400/30"          :
    status === "processing" ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/30"    :
                              "bg-zinc-700/60 text-zinc-400 border-zinc-600/50";
  return (
    <span className={cn("px-1.5 py-0.5 text-xs rounded border capitalize", cls)}>
      {status}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">{children}</div>
  );
}

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1 border-b border-zinc-800/60 last:border-0">
      <span className="text-xs text-zinc-500 shrink-0">{label}</span>
      <span className={cn("text-xs text-zinc-300 text-right break-all", mono && "font-mono")}>{value}</span>
    </div>
  );
}

// ─── Charts (div-based) ───────────────────────────────────────────────────────

function BarChart({ data, colorClass }: { data: number[]; colorClass: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-0.5 h-14">
      {data.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col justify-end">
          <div
            className={cn("rounded-sm transition-all", colorClass)}
            style={{ height: `${Math.round((v / max) * 100)}%`, minHeight: v > 0 ? "2px" : "0" }}
          />
        </div>
      ))}
    </div>
  );
}

function DualBarChart({ data }: { data: MetricPoint[] }) {
  const maxIn  = Math.max(...data.map((d) => d.messagesIn), 1);
  const maxOut = Math.max(...data.map((d) => d.messagesOut), 1);
  const maxVal = Math.max(maxIn, maxOut);
  return (
    <div>
      <div className="flex gap-4 mb-2">
        <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 rounded bg-indigo-500" /><span className="text-xs text-zinc-400">Messages In</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 rounded bg-emerald-400" /><span className="text-xs text-zinc-400">Messages Out</span></div>
      </div>
      <div className="flex items-end gap-1 h-24">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex items-end gap-px">
            <div className="flex-1 flex flex-col justify-end">
              <div className="bg-indigo-500 rounded-t-sm opacity-80" style={{ height: `${Math.round((d.messagesIn / maxVal) * 100)}%`, minHeight: "2px" }} />
            </div>
            <div className="flex-1 flex flex-col justify-end">
              <div className="bg-emerald-400 rounded-t-sm opacity-70" style={{ height: `${Math.round((d.messagesOut / maxVal) * 100)}%`, minHeight: "2px" }} />
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1">
        {data.map((d, i) => (
          i % 3 === 0 ? <span key={i} className="text-xs text-zinc-600">{d.time}</span> : null
        ))}
      </div>
    </div>
  );
}

function ErrorRateChart({ data }: { data: MetricPoint[] }) {
  const max = Math.max(...data.map((d) => d.errorRate), 1);
  return (
    <div className="flex items-end gap-0.5 h-10">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col justify-end">
          <div
            className="bg-rose-400 rounded-sm opacity-75"
            style={{ height: `${Math.round((d.errorRate / max) * 100)}%`, minHeight: d.errorRate > 0 ? "2px" : "0" }}
          />
        </div>
      ))}
    </div>
  );
}

function ConsumerLagChart({ data }: { data: MetricPoint[] }) {
  const max = Math.max(...data.map((d) => d.consumerLag), 1);
  return (
    <div className="flex items-end gap-0.5 h-10">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col justify-end">
          <div
            className="bg-amber-400 rounded-sm opacity-75"
            style={{ height: `${Math.round((d.consumerLag / max) * 100)}%`, minHeight: "2px" }}
          />
        </div>
      ))}
    </div>
  );
}

function AgeGauge({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = pct > 75 ? "bg-rose-400" : pct > 40 ? "bg-amber-400" : "bg-emerald-400";
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs text-zinc-400">{label}</span>
        <span className="text-xs text-white font-mono">{value}m</span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function QueueBarChart({ queues }: { queues: Queue[] }) {
  const max = Math.max(...queues.map((q) => q.depth), 1);
  return (
    <div className="flex flex-col gap-1.5">
      {queues.map((q) => (
        <div key={q.id} className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 w-36 truncate shrink-0 font-mono">{q.name}</span>
          <div className="flex-1 h-4 bg-zinc-800 rounded overflow-hidden">
            <div
              className="h-full bg-indigo-500 opacity-75 rounded"
              style={{ width: `${Math.round((q.depth / max) * 100)}%`, minWidth: "2px" }}
            />
          </div>
          <span className="text-xs text-zinc-300 font-mono w-10 text-right shrink-0">{formatDepth(q.depth)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Trajectory Timeline ──────────────────────────────────────────────────────

function TrajectoryTimeline({ steps }: { steps: TrajectoryStep[] }) {
  const dotColor: Record<TrajectoryStatus, string> = {
    received:   "bg-zinc-500",
    processing: "bg-indigo-500",
    delivered:  "bg-emerald-400",
    failed:     "bg-rose-400",
  };
  return (
    <div className="flex flex-col">
      {steps.map((step, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className={cn("w-2.5 h-2.5 rounded-full mt-0.5 shrink-0", dotColor[step.status])} />
            {i < steps.length - 1 && <div className="w-px bg-zinc-700 flex-1 my-1" />}
          </div>
          <div className="pb-3 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs text-white font-medium capitalize">{step.status}</span>
            </div>
            <div className="text-xs text-zinc-400">{step.detail}</div>
            <div className="text-xs text-zinc-600 font-mono">{step.timestamp}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab 1: Queues ────────────────────────────────────────────────────────────

function QueuesTab({ selectedQueueId, onSelectQueue }: { selectedQueueId: string; onSelectQueue: (id: string) => void }) {
  const selectedQueue = QUEUES.find((q) => q.id === selectedQueueId) ?? QUEUES[0];
  const queueConsumers = CONSUMERS.filter((c) => c.queueId === selectedQueue.id);

  return (
    <div className="flex gap-4 h-full min-h-0">
      {/* Left — Queue List */}
      <div className="w-72 shrink-0 flex flex-col gap-1 overflow-y-auto">
        {QUEUES.map((q) => (
          <button
            key={q.id}
            onClick={() => onSelectQueue(q.id)}
            className={cn(
              "w-full text-left px-3 py-2.5 rounded-lg border transition-colors",
              q.id === selectedQueueId
                ? "bg-zinc-800 border-indigo-500/40"
                : "bg-zinc-900 border-zinc-800 hover:bg-zinc-800/60"
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-white truncate">{q.name}</span>
              <QueueTypeBadge type={q.type} />
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-500">
              <span>depth <span className="text-zinc-300 font-mono">{formatDepth(q.depth)}</span></span>
              <span>consumers <span className="text-zinc-300 font-mono">{q.consumers}</span></span>
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-500 mt-0.5">
              <span><span className="text-zinc-300 font-mono">{q.throughputPerSec.toFixed(1)}</span>/s</span>
              <span>age <span className="text-zinc-300 font-mono">{q.oldestMessageAge}</span></span>
              {q.dlqDepth > 0 && (
                <span className="text-rose-400 font-semibold">DLQ {q.dlqDepth}</span>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Right — Queue Detail */}
      <div className="flex-1 min-w-0 overflow-y-auto flex flex-col gap-4">
        {/* Header */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg font-semibold text-white font-mono">{selectedQueue.name}</span>
                <QueueTypeBadge type={selectedQueue.type} />
              </div>
              <div className="text-xs text-zinc-500">Queue ID: {selectedQueue.id}</div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-xs text-emerald-400">Active</span>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Depth",        value: formatDepth(selectedQueue.depth),               sub: "messages" },
              { label: "Consumers",    value: String(selectedQueue.consumers),                sub: "active workers" },
              { label: "Throughput",   value: selectedQueue.throughputPerSec.toFixed(1),      sub: "msg/sec" },
              { label: "Oldest Msg",   value: selectedQueue.oldestMessageAge,                 sub: "in queue" },
            ].map((stat) => (
              <div key={stat.label} className="bg-zinc-800/60 rounded-lg p-3">
                <div className="text-xs text-zinc-500 mb-1">{stat.label}</div>
                <div className="text-xl font-bold text-white font-mono">{stat.value}</div>
                <div className="text-xs text-zinc-600">{stat.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Throughput Chart */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <SectionLabel>Throughput — last 12 intervals</SectionLabel>
          <BarChart data={selectedQueue.throughputHistory} colorClass="bg-indigo-500 opacity-80 hover:opacity-100" />
          <div className="flex justify-between mt-2">
            <span className="text-xs text-zinc-600">−11</span>
            <span className="text-xs text-zinc-600">now</span>
          </div>
        </div>

        {/* Consumers */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <SectionLabel>Consumers ({queueConsumers.length})</SectionLabel>
          <div className="flex flex-col gap-1">
            {queueConsumers.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-zinc-800/40 transition-colors">
                <StatusDot status={c.status} />
                <span className="text-xs font-mono text-zinc-300 flex-1">{c.host}</span>
                <span className="text-xs text-zinc-500 capitalize">{c.status}</span>
                <span className="text-xs font-mono text-white w-14 text-right">
                  {c.messagesPerSec.toFixed(1)}/s
                </span>
                <span className="text-xs text-zinc-600 w-16 text-right">{c.lastHeartbeat}</span>
              </div>
            ))}
            {queueConsumers.length === 0 && (
              <ContextualEmptyState
                icon={Users}
                title="No consumers connected"
                description="No active consumers are listening on this queue."
                size="sm"
              />
            )}
          </div>
        </div>

        {/* DLQ Stats */}
        {selectedQueue.dlqDepth > 0 && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4">
            <SectionLabel>Dead Letter Queue</SectionLabel>
            <div className="flex items-center gap-3">
              <div className="text-2xl font-bold text-rose-400 font-mono">{selectedQueue.dlqDepth}</div>
              <div>
                <div className="text-sm text-rose-300">failed messages</div>
                <div className="text-xs text-zinc-500">Inspect in Dead Letter tab</div>
              </div>
            </div>
          </div>
        )}

        {/* Configuration */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <SectionLabel>Configuration</SectionLabel>
          <KV label="Type"                     value={selectedQueue.type.toUpperCase()} />
          <KV label="Visibility Timeout"       value={formatSeconds(selectedQueue.visibilityTimeout)} />
          <KV label="Max Receive Count"        value={String(selectedQueue.maxReceiveCount)} />
          <KV label="Message Retention"        value={formatSeconds(selectedQueue.messageRetentionPeriod)} />
          <KV label="Delivery Delay"           value={selectedQueue.deliveryDelay > 0 ? formatSeconds(selectedQueue.deliveryDelay) : "None"} />
        </div>
      </div>
    </div>
  );
}

// ─── Tab 2: Messages ──────────────────────────────────────────────────────────

function MessagesTab() {
  const [msgQueueFilter, setMsgQueueFilter] = useState<string>("all");
  const [searchFilter,   setSearchFilter]   = useState<string>("");
  const [selectedId,     setSelectedId]     = useState<string>("");

  const filtered = MESSAGES.filter((m) => {
    const matchQueue = msgQueueFilter === "all" || m.queueId === msgQueueFilter;
    const term = searchFilter.toLowerCase();
    const matchSearch = !term || m.id.toLowerCase().includes(term) || m.bodyPreview.toLowerCase().includes(term);
    return matchQueue && matchSearch;
  });

  const selected = MESSAGES.find((m) => m.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="flex gap-4 h-full min-h-0">
      {/* Left */}
      <div className="w-80 shrink-0 flex flex-col gap-2 min-h-0">
        {/* Filters */}
        <div className="flex flex-col gap-2 shrink-0">
          <select
            value={msgQueueFilter}
            onChange={(e) => setMsgQueueFilter(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
          >
            <option value="all">All Queues</option>
            {QUEUES.map((q) => (
              <option key={q.id} value={q.id}>{q.name}</option>
            ))}
          </select>
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search message ID or body…"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500"
          />
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-1">
          {filtered.length === 0 && (
            <ContextualEmptyState
              icon={Inbox}
              title="Queue is empty"
              description="No messages match your filters. The queue may be fully consumed."
              size="sm"
            />
          )}
          {filtered.map((m) => {
            const queue = QUEUES.find((q) => q.id === m.queueId);
            return (
              <button
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg border transition-colors",
                  m.id === (selected?.id)
                    ? "bg-zinc-800 border-indigo-500/40"
                    : "bg-zinc-900 border-zinc-800 hover:bg-zinc-800/60"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-indigo-400">{m.id}</span>
                  <TrajectoryBadge status={m.trajectory[m.trajectory.length - 1].status} />
                </div>
                <div className="text-xs text-zinc-400 truncate mb-1">{truncate(m.bodyPreview, 58)}</div>
                <div className="flex items-center gap-3 text-xs text-zinc-600">
                  <span>{queue?.name ?? m.queueId}</span>
                  <span>recv ×{m.receiveCount}</span>
                  <span>{m.sendTimestamp.slice(11, 19)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right — Message Detail */}
      {selected ? (
        <div className="flex-1 min-w-0 overflow-y-auto flex flex-col gap-4">
          {/* Header */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="text-xs text-zinc-500 mb-1">Message ID</div>
                <div className="text-sm font-mono text-white">{selected.id}</div>
              </div>
              <TrajectoryBadge status={selected.trajectory[selected.trajectory.length - 1].status} />
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="bg-zinc-800/60 rounded-lg p-2">
                <div className="text-xs text-zinc-500">Receive Count</div>
                <div className="text-lg font-bold text-white font-mono">{selected.receiveCount}</div>
              </div>
              <div className="bg-zinc-800/60 rounded-lg p-2">
                <div className="text-xs text-zinc-500">Sent</div>
                <div className="text-xs font-mono text-zinc-300">{selected.sendTimestamp.slice(11, 19)}</div>
              </div>
              <div className="bg-zinc-800/60 rounded-lg p-2">
                <div className="text-xs text-zinc-500">First Received</div>
                <div className="text-xs font-mono text-zinc-300">{selected.firstReceiveTimestamp.slice(11, 19)}</div>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <SectionLabel>Message Body</SectionLabel>
            <pre className="text-xs font-mono text-zinc-300 bg-zinc-800/60 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
              {selected.body}
            </pre>
          </div>

          {/* Attributes */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <SectionLabel>Attributes</SectionLabel>
            {Object.entries(selected.attributes).map(([k, v]) => (
              <KV key={k} label={k} value={v} mono />
            ))}
          </div>

          {/* Trajectory */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <SectionLabel>Message Trajectory</SectionLabel>
            <TrajectoryTimeline steps={selected.trajectory} />
          </div>

          {/* Retry History */}
          {selected.retryHistory.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <SectionLabel>Retry History</SectionLabel>
              <div className="flex flex-col gap-2">
                {selected.retryHistory.map((r) => (
                  <div key={r.attempt} className="flex items-start gap-3 px-3 py-2 bg-zinc-800/40 rounded-lg">
                    <span className="text-xs font-mono text-zinc-500 shrink-0">#{r.attempt}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-xs font-semibold", r.result === "success" ? "text-emerald-400" : "text-rose-400")}>
                          {r.result === "success" ? "Succeeded" : "Failed"}
                        </span>
                        <span className="text-xs text-zinc-600 font-mono">{r.timestamp.slice(11, 19)}</span>
                      </div>
                      {r.error && <div className="text-xs text-rose-400/80 mt-0.5">{r.error}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
          Select a message to inspect
        </div>
      )}
    </div>
  );
}

// ─── Tab 3: Dead Letter ───────────────────────────────────────────────────────

function DeadLetterTab() {
  const [selectedId, setSelectedId] = useState<string>("");
  const selected = DLQ_ENTRIES.find((d) => d.id === selectedId) ?? DLQ_ENTRIES[0] ?? null;

  return (
    <div className="flex gap-4 h-full min-h-0">
      {/* Left — DLQ List */}
      <div className="w-80 shrink-0 flex flex-col gap-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-2 px-1 shrink-0">
          <span className="text-xs text-zinc-500">{DLQ_ENTRIES.length} failed messages</span>
          <span className="text-xs text-rose-400 font-semibold">DLQ Active</span>
        </div>
        {DLQ_ENTRIES.map((d) => (
          <button
            key={d.id}
            onClick={() => setSelectedId(d.id)}
            className={cn(
              "w-full text-left px-3 py-2.5 rounded-lg border transition-colors",
              d.id === (selected?.id)
                ? "bg-zinc-800 border-rose-500/40"
                : "bg-zinc-900 border-zinc-800 hover:bg-zinc-800/60"
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono text-rose-400">{d.messageId}</span>
              <span className="text-xs bg-rose-500/20 text-rose-400 border border-rose-500/30 px-1.5 py-0.5 rounded">
                ×{d.receiveCount}
              </span>
            </div>
            <div className="text-xs text-zinc-400 mb-1 truncate">{truncate(d.failureReason, 55)}</div>
            <div className="flex items-center gap-2 text-xs text-zinc-600">
              <span>{d.originalQueueName}</span>
              <span>{d.firstSentTimestamp.slice(11, 16)}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Right — DLQ Detail */}
      {selected ? (
        <div className="flex-1 min-w-0 overflow-y-auto flex flex-col gap-4">
          {/* Header */}
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="text-xs text-zinc-500 mb-1">Dead Letter Message</div>
                <div className="text-sm font-mono text-white">{selected.messageId}</div>
              </div>
              <span className="text-xs bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-1 rounded-lg font-semibold">
                Failed ×{selected.receiveCount}
              </span>
            </div>
            <div className="bg-rose-500/10 rounded-lg p-3 mt-2">
              <div className="text-xs text-zinc-500 mb-1">Failure Reason</div>
              <div className="text-sm text-rose-300">{selected.failureReason}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="bg-zinc-800/60 rounded-lg p-2">
                <div className="text-xs text-zinc-500">Original Queue</div>
                <div className="text-xs font-mono text-zinc-300">{selected.originalQueueName}</div>
              </div>
              <div className="bg-zinc-800/60 rounded-lg p-2">
                <div className="text-xs text-zinc-500">First Sent</div>
                <div className="text-xs font-mono text-zinc-300">{selected.firstSentTimestamp}</div>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <SectionLabel>Message Body</SectionLabel>
            <pre className="text-xs font-mono text-zinc-300 bg-zinc-800/60 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
              {selected.body}
            </pre>
          </div>

          {/* Attributes */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <SectionLabel>Attributes & Context</SectionLabel>
            {Object.entries(selected.attributes).map(([k, v]) => (
              <KV key={k} label={k} value={v} mono />
            ))}
          </div>

          {/* Actions */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <SectionLabel>Actions</SectionLabel>
            <div className="flex gap-3">
              <button className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
                Retry Message
              </button>
              <button className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold py-2.5 rounded-lg transition-colors">
                Redrive to Queue
              </button>
              <button className="px-4 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 text-sm font-semibold py-2.5 rounded-lg transition-colors border border-rose-500/30">
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
          Select a failed message to inspect
        </div>
      )}
    </div>
  );
}

// ─── Tab 4: Metrics ───────────────────────────────────────────────────────────

function MetricsTab() {
  const totalIn    = METRICS.reduce((s, d) => s + d.messagesIn,  0);
  const totalOut   = METRICS.reduce((s, d) => s + d.messagesOut, 0);
  const avgError   = METRICS.reduce((s, d) => s + d.errorRate,   0) / METRICS.length;
  const currentLag = METRICS[METRICS.length - 1].consumerLag;
  const maxOldestMin = 35;

  return (
    <div className="flex flex-col gap-4 overflow-y-auto">
      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total In (12 intervals)",  value: String(totalIn),          sub: "messages",   color: "text-indigo-400" },
          { label: "Total Out",                value: String(totalOut),          sub: "messages",   color: "text-emerald-400" },
          { label: "Avg Error Rate",           value: avgError.toFixed(2) + "%", sub: "per interval", color: "text-rose-400" },
          { label: "Consumer Lag",             value: String(currentLag),        sub: "messages",   color: "text-amber-400" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="text-xs text-zinc-500 mb-1">{kpi.label}</div>
            <div className={cn("text-2xl font-bold font-mono", kpi.color)}>{kpi.value}</div>
            <div className="text-xs text-zinc-600">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Throughput Chart */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <SectionLabel>Throughput — messages in/out per 5-minute interval</SectionLabel>
        <DualBarChart data={METRICS} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Error Rate */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <SectionLabel>Error Rate %</SectionLabel>
          <ErrorRateChart data={METRICS} />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-zinc-600">{METRICS[0].time}</span>
            <span className="text-xs text-zinc-600">{METRICS[METRICS.length - 1].time}</span>
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            Peak: <span className="text-rose-400 font-mono">{Math.max(...METRICS.map((d) => d.errorRate)).toFixed(2)}%</span>
            {" "}at {METRICS.reduce((a, b) => a.errorRate > b.errorRate ? a : b).time}
          </div>
        </div>

        {/* Consumer Lag */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <SectionLabel>Consumer Lag</SectionLabel>
          <ConsumerLagChart data={METRICS} />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-zinc-600">{METRICS[0].time}</span>
            <span className="text-xs text-zinc-600">{METRICS[METRICS.length - 1].time}</span>
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            Current: <span className="text-amber-400 font-mono">{currentLag}</span> messages behind
          </div>
        </div>
      </div>

      {/* Oldest Message Age Gauges */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <SectionLabel>Oldest Message Age by Queue</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          {QUEUES.map((q) => {
            const parts = q.oldestMessageAge.split(" ");
            let minutes = 0;
            parts.forEach((p) => {
              if (p.endsWith("m")) minutes += parseInt(p, 10);
              else if (p.endsWith("s")) minutes += parseInt(p, 10) / 60;
              else if (p.endsWith("h")) minutes += parseInt(p, 10) * 60;
            });
            return (
              <AgeGauge key={q.id} label={q.name} value={Math.round(minutes)} max={maxOldestMin} />
            );
          })}
        </div>
      </div>

      {/* Message Count by Queue */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <SectionLabel>Queue Depth Comparison</SectionLabel>
        <QueueBarChart queues={QUEUES} />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function QueueInspector() {
  const [activeTab,       setActiveTab]       = useState<TabId>("queues");
  const [selectedQueueId, setSelectedQueueId] = useState<string>("q1");

  const tabs: { id: TabId; label: string; badge?: number }[] = [
    { id: "queues",      label: "Queues",      badge: QUEUES.length },
    { id: "messages",    label: "Messages",    badge: MESSAGES.length },
    { id: "deadletter",  label: "Dead Letter", badge: DLQ_ENTRIES.length },
    { id: "metrics",     label: "Metrics" },
  ];

  const totalDLQ = QUEUES.reduce((s, q) => s + q.dlqDepth, 0);

  return (
    <div className="flex flex-col h-full bg-zinc-950 min-h-0">
      {/* Page Header */}
      <div className="shrink-0 px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Queue Inspector</h1>
            <p className="text-sm text-zinc-400 mt-0.5">
              {QUEUES.length} queues · {QUEUES.reduce((s, q) => s + q.depth, 0).toLocaleString()} messages ·{" "}
              {QUEUES.reduce((s, q) => s + q.consumers, 0)} consumers
              {totalDLQ > 0 && (
                <span className="ml-2 text-rose-400 font-semibold">{totalDLQ} in DLQ</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-zinc-400">Live</span>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="shrink-0 flex gap-1 px-6 border-b border-zinc-800 pb-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors",
              activeTab === tab.id
                ? "text-white border-indigo-500 bg-zinc-900/60"
                : "text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-zinc-900/30"
            )}
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span className={cn(
                "text-xs px-1.5 py-0.5 rounded font-mono",
                activeTab === tab.id
                  ? (tab.id === "deadletter" ? "bg-rose-500/30 text-rose-300" : "bg-indigo-500/30 text-indigo-300")
                  : "bg-zinc-800 text-zinc-500"
              )}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-hidden px-6 py-4">
        {activeTab === "queues" && (
          <QueuesTab
            selectedQueueId={selectedQueueId}
            onSelectQueue={setSelectedQueueId}
          />
        )}
        {activeTab === "messages"   && <MessagesTab />}
        {activeTab === "deadletter" && <DeadLetterTab />}
        {activeTab === "metrics"    && <MetricsTab />}
      </div>
    </div>
  );
}
