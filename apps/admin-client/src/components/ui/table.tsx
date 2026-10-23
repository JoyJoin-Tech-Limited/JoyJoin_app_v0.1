import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Scroll wrapper props. `containerClassName` styles the div that wraps the
 * `<table>` (the table itself keeps `className`) — see the sticky note below
 * before adding overflow here.
 */
type TableProps = React.HTMLAttributes<HTMLTableElement> & {
  containerClassName?: string
}

/**
 * The wrapper is a horizontal scroller for ordinary tables, and deliberately
 * NOT a scroll container for tables that ask for a sticky header.
 *
 * History: it used to be `relative w-full overflow-auto` for everyone, which made
 * the div the `thead`'s scrollport. Because that div's height is
 * content-determined, it can never scroll vertically, so `sticky top-0` on a
 * header had no range to pin against and never engaged — silently, with no
 * visual clue. Measured in Chromium against this app's compiled Tailwind CSS,
 * 60 rows, scrollTop 0 → 300:
 *
 *   wrapper overflow-auto → header moved -198px                (inert)
 *   wrapper no overflow   → header pinned at the scrollport top (engages)
 *
 * Why the obvious split cannot fix it: CSS Overflow 3 makes an axis that is
 * `visible` compute to `auto` when the other axis is not `visible`. So
 * `overflow-x-auto overflow-y-visible` computes to `auto/auto` (verified via
 * `getComputedStyle`) — still a scroll container in both axes, still a dead
 * sticky header. Horizontal scrolling and "not a scroll container" are mutually
 * exclusive on one element, so the choice is made per table:
 *
 *   - no sticky header  → `overflow-x-auto` (unchanged behaviour; wide tables
 *     keep the scrollbar they have always had, inside their card)
 *   - sticky header     → no overflow, so `sticky top-0` resolves against the
 *     nearest real scrollport: `<main className="… overflow-auto">` in
 *     `AdminLayout`, or a fixed-height `ScrollArea` viewport (verified with a
 *     600px viewport). Horizontal reach is then the content pane's job — or, if a
 *     table is both sticky and wide, the caller bounds this wrapper
 *     (`containerClassName="max-h-[70vh] overflow-auto"`), which makes the wrapper
 *     the actual vertical scrollport so sticky pins *and* horizontal scrolling
 *     survives (verified).
 *
 * The `:has()` gate keys off the `sticky` class on `TableHeader`, which is the
 * documented way to ask for a sticky header on this primitive. Where `:has()` is
 * unsupported the rule drops and the wrapper keeps its scrollbar — i.e. today's
 * behaviour, not a broken layout.
 */
const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, containerClassName, ...props }, ref) => (
    <div
      className={cn(
        "relative w-full [&:not(:has(thead.sticky))]:overflow-x-auto",
        containerClassName,
      )}
    >
      <table
        ref={ref}
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
)
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
