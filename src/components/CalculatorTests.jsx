import { useEffect, useRef, useState } from "react";
import { trackEvent } from "../lib/analytics/trackEvent";
import "../styles/calculatorTests.css";

/**
 * Generic "Tests" button + scrollable popup + table, meant to sit inline
 * next to a calculator's vote widget and "Copy shareable link" button.
 * Fully data-driven so the same component serves every calculator —
 * headers, values, and row count all come from props, nothing here is
 * calculator-specific.
 *
 * Each calculator owns its own test data in a sibling module (see
 * angular-size-calculator/angularSizeTests.js for the pattern): it runs
 * the calculator's real math functions against known reference values and
 * edge cases, and hands the already-computed rows to this component. This
 * component only renders them — it has no domain knowledge of its own.
 *
 * @param {{
 *   title?: string,
 *   columns: { key: string, label: string }[],
 *   rows: Record<string, any>[],
 *   sources?: { title: string, text: string, url?: string, urlLabel?: string }[],
 * }} props
 *
 * A row may include a boolean `pass` field — when `columns` has a column
 * keyed "result", that column renders a Pass/Fail badge from `row.pass`
 * instead of a plain text value.
 *
 * `sources` is optional and renders as a "Sources & caveats" list at the
 * bottom of the popup, below the table — where the reference data in the
 * table actually came from, and what the checks do or don't prove. Omit
 * it if a calculator's rows don't rely on any external reference data.
 */
export default function CalculatorTests({ title, columns, rows, sources }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    dialogRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  if (!Array.isArray(columns) || columns.length === 0 || !Array.isArray(rows)) return null;

  const passCount = rows.filter((r) => r.pass === true).length;
  const failCount = rows.filter((r) => r.pass === false).length;
  const hasPassFail = passCount + failCount > 0;

  function openDialog() {
    trackEvent("calculator-tests-open", { calculator: title, passCount, failCount, rowCount: rows.length });
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className="calc-tests-btn"
        onClick={openDialog}
        aria-haspopup="dialog"
      >
        Tests
      </button>

      {open && (
        <div className="calc-tests-overlay" role="presentation" onClick={close}>
          <div
            className="calc-tests-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={title || "Test cases"}
            ref={dialogRef}
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="calc-tests-header">
              <div>
                <p className="calc-tests-title">{title || "Test cases"}</p>
                {hasPassFail && (
                  <p className="calc-tests-summary">
                    <span className="calc-tests-summary-pass">{passCount} passing</span>
                    {failCount > 0 && <span className="calc-tests-summary-fail"> · {failCount} failing</span>}
                    {" "}out of {rows.length}
                  </p>
                )}
              </div>
              <button type="button" className="calc-tests-close" onClick={close} aria-label="Close">
                ✕
              </button>
            </div>

            <div className="calc-tests-body">
              <table className="calc-tests-table">
                <thead>
                  <tr>
                    {columns.map((col) => (
                      <th key={col.key} scope="col">{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.id ?? i} className={row.pass === false ? "calc-tests-row--fail" : undefined}>
                      {columns.map((col) => (
                        <td key={col.key}>
                          {col.key === "result" && typeof row.pass === "boolean" ? (
                            <span className={`calc-tests-badge${row.pass ? " is-pass" : " is-fail"}`}>
                              {row.pass ? "Pass" : "Fail"}
                            </span>
                          ) : (
                            row[col.key] ?? "—"
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              {Array.isArray(sources) && sources.length > 0 && (
                <div className="calc-tests-sources">
                  <p className="calc-tests-sources-title">Sources &amp; caveats</p>
                  <dl>
                    {sources.map((source) => (
                      <div className="calc-tests-source" key={source.title}>
                        <dt>{source.title}</dt>
                        <dd>
                          {source.text}
                          {source.url && (
                            <>
                              {" "}
                              <a href={source.url} target="_blank" rel="noopener noreferrer">
                                {source.urlLabel || source.url}
                              </a>
                            </>
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
