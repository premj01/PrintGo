export function buildSections({ bwPageCount, colorPageCount, totalPages }, printers) {
    if (![bwPageCount, colorPageCount, totalPages].every(n => Number.isSafeInteger(n) && n >= 0) ||
        totalPages < 1 || bwPageCount + colorPageCount !== totalPages) {
        throw new Error("Invalid page counts for the merged PDF.");
    }

    let first = 1;
    const sections = [];
    for (const [mode, count, rate] of [["bw", bwPageCount, 100], ["color", colorPageCount, 400]]) {
        if (!count) continue;
        const last = first + count - 1;
        const name = printers?.[mode]?.name;
        sections.push({
            mode, pageRanges: first === last ? String(first) : first + "-" + last,
            printer: name && name !== "dummy" ? name : null,
            colorMode: mode === "bw" ? "monochrome" : "color",
            amount: count * rate, status: "waiting",
        });
        first = last + 1;
    }
    return sections;
}

export function summarizeSections(sections) {
    if (sections.some(section => ["queued", "waiting"].includes(section.status))) return "printing";
    if (sections.some(section => section.status === "unknown")) return "needs-review";
    const failed = sections.filter(section => section.status === "failed");
    if (!failed.length) return "print-completed";
    return failed.length === sections.length ? "print-failed" : "partially-printed";
}
