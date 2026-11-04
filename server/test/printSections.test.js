import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { buildSections } from "../src/services/printSections.js";

let row, refunds, deletions;
const table = {
    async findFirst() { return structuredClone(row); },
    async findUnique() { return structuredClone(row); },
    async updateMany({ where, data }) {
        if (JSON.stringify(where.fileConfig.equals) !== JSON.stringify(row.fileConfig)) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
    },
    async update({ data }) { Object.assign(row, data); },
};
mock.module("../src/config/prisma.js", { defaultExport: { noAuthUser: table } });
mock.module("../src/services/s3Storage.service.js", { namedExports: { deleteObjectByKey: async key => deletions.push(key) } });
mock.module("../src/services/razorpay.service.js", { namedExports: {
    initiateRefund: async (_, amount) => {
        refunds.push(amount);
        return { id: "refund", status: "processed" };
    },
} });
const { recordSectionUpdate } = await import("../src/services/sectionResults.js");
const printers = { bw: { name: "Mono" }, color: { name: "Colour" } };

test("constructs contiguous ranges for the configured queues, skipping empty sections", () => {
    const plan = (bwPageCount, colorPageCount) => buildSections({ bwPageCount, colorPageCount, totalPages: bwPageCount + colorPageCount }, printers)
        .map(s => [s.printer, s.pageRanges, s.amount]);
    assert.deepEqual(plan(3, 2), [["Mono", "1-3", 300], ["Colour", "4-5", 800]]);
    assert.deepEqual(plan(0, 2), [["Colour", "1-2", 800]]);
    assert.deepEqual(plan(1, 0), [["Mono", "1", 100]]);
    assert.throws(() => plan(0, 0));
});

for (const [bw, color, amount, status] of [
    ["completed", "failed", 800, "partially-printed"],
    ["failed", "completed", 300, "partially-printed"],
    ["failed", "failed", 1100, "print-failed"],
    ["completed", "completed", 0, "print-completed"],
    ["completed", "unknown", 0, "needs-review"],
]) {
    test(bw + " B&W and " + color + " color", async () => {
        refunds = [];
        deletions = [];
        const sections = buildSections({ bwPageCount: 3, colorPageCount: 2, totalPages: 5 }, printers);
        row = { fileConfig: { sections, fileKey: "merged.pdf", revision: 0 }, updatedAt: new Date(),
            paymentAmount: 11, paymentStatus: "success", razorpayPaymentId: "payment" };
        const snapshot = { sessionId: "session", batchId: "batch", revision: 1, results: [
            { mode: "bw", status: bw }, { mode: "color", status: "queued" },
        ] };
        await recordSectionUpdate("kiosk", snapshot);
        assert.deepEqual(refunds, []);
        assert.deepEqual(deletions, []);
        snapshot.revision++;
        snapshot.results[1].status = color;
        snapshot.finished = true;
        await Promise.all([recordSectionUpdate("kiosk", snapshot), recordSectionUpdate("kiosk", snapshot)]);
        await recordSectionUpdate("kiosk", snapshot);
        assert.equal(row.printStatus, status);
        assert.deepEqual(refunds, amount ? [amount] : []);
        assert.deepEqual(deletions, color === "unknown" ? [] : ["merged.pdf"]);
    });
}
