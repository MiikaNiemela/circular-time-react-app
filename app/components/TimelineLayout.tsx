import type { ReactNode } from "react";
import {
  layoutContainer,
  shell,
  header,
  brand as brandClass,
  actions as actionsClass,
  controls as controlsClass,
  body,
  circleArea,
  panel,
  section,
  sectionTitle,
} from "./TimelineLayout.css";

/** One titled block in the side panel. */
export interface PanelSection {
  /** Stable id; also used to link the heading to its section. */
  id: string;
  title: string;
  content: ReactNode;
}

export interface TimelineLayoutProps {
  /** Product name and mark, top left. */
  brand: ReactNode;
  /** Small header actions such as theme and settings, top right. */
  actions: ReactNode;
  /** View selector and period navigation. */
  controls: ReactNode;
  /** The circle, plus anything that belongs directly with it. */
  circle: ReactNode;
  /** Side-panel sections, in reading order. */
  sections: PanelSection[];
}

/**
 * The timeline screen's layout. Below 1024 px of available width it is one
 * column: header, controls, circle, then the sections. From 1024 px the
 * controls join the header row and the sections move to a panel beside the
 * circle. The DOM order is the reading order at every width.
 */
export function TimelineLayout({
  brand,
  actions,
  controls,
  circle,
  sections,
}: TimelineLayoutProps) {
  return (
    <div className={layoutContainer}>
      <div className={shell}>
        <header className={header} data-layout="header">
          <div className={brandClass} data-layout="brand">
            {brand}
          </div>
          <div className={actionsClass} data-layout="actions">
            {actions}
          </div>
          <div className={controlsClass} data-layout="controls">
            {controls}
          </div>
        </header>
        <main className={body} data-layout="body">
          <div className={circleArea} data-layout="circle">
            {circle}
          </div>
          {sections.length > 0 && (
            <div className={panel} data-layout="panel">
              {sections.map((s) => (
                <section key={s.id} className={section} aria-labelledby={`section-${s.id}`}>
                  <h2 id={`section-${s.id}`} className={sectionTitle}>
                    {s.title}
                  </h2>
                  {s.content}
                </section>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
