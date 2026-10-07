"use client";

import { useState } from "react";
import type { Guard } from "./management-types";
import PageHeading from "./PageHeading";
import Metric from "./Metric";
import GuardPhoto from "./GuardPhoto";

export default function Roster({
  guards, allGuards, allCount, active, query, setQuery, filter, setFilter,
  genderFilter, setGenderFilter, workTypeFilter, setWorkTypeFilter,
  shiftFilter, setShiftFilter, designationFilter, setDesignationFilter,
  siteFilter, setSiteFilter, onAdd, onSelect, onToggle, onDelete, onBackHome
}: {
  guards: Guard[]; allGuards: Guard[]; allCount: number; active: number;
  query: string; setQuery: (s: string) => void; filter: string; setFilter: (s: string) => void;
  genderFilter: string; setGenderFilter: (s: string) => void;
  workTypeFilter: string; setWorkTypeFilter: (s: string) => void;
  shiftFilter: string; setShiftFilter: (s: string) => void;
  designationFilter: string; setDesignationFilter: (s: string) => void;
  siteFilter: string; setSiteFilter: (s: string) => void;
  onAdd: () => void; onSelect: (g: Guard) => void; onToggle: (g: Guard) => void; onDelete: (g: Guard) => void; onBackHome: () => void;
}) {
  const [draftGender, setDraftGender] = useState(genderFilter);
  const [draftWorkType, setDraftWorkType] = useState(workTypeFilter);
  const [draftShift, setDraftShift] = useState(shiftFilter);
  const [draftDesignation, setDraftDesignation] = useState(designationFilter);
  const [draftSite, setDraftSite] = useState(siteFilter);

  const applyFilters = () => {
    setGenderFilter(draftGender);
    setWorkTypeFilter(draftWorkType);
    setShiftFilter(draftShift);
    setDesignationFilter(draftDesignation);
    setSiteFilter(draftSite);
  };

  const optionList = (key: keyof Guard) =>
    Array.from(new Set(allGuards.map(g => String(g[key] ?? "")).filter(Boolean))).sort();

  return <div className="content-wrap">
    <button type="button" className="mobile-back-home" onClick={onBackHome}>← &nbsp; Back to Home</button>
    <PageHeading eyebrow="Personnel directory" title="Security Personnel Roster" subtitle={`${allCount} total enrolled guards · ${active} on active deployment`} action={<button className="primary-button" onClick={onAdd}>＋ &nbsp; Enroll New Guard</button>} />
    <section className="summary-row roster-stats">
      <Metric label="TOTAL ENROLLED PERSONNEL" value={allCount} note="Roster count" icon="♙" tone="blue" />
      <Metric label="ACTIVE DEPLOYMENTS" value={active} note="On duty" icon="♙" tone="green" />
      <Metric label="INACTIVE / ON LEAVE" value={allCount-active} note="Standby" icon="♙" tone="red" />
    </section>
    <div className="roster-toolbar">
      <div className="search-wrap"><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, guard ID, site, designation, phone, or Aadhaar…" /></div>
      <div className="filter-buttons">{["All", "Active", "Inactive"].map(x => <button key={x} onClick={() => setFilter(x)} className={filter === x ? "selected-filter" : ""}>{x}</button>)}</div>
      <div className="roster-filters">
        <label>Gender<select value={draftGender} onChange={e => setDraftGender(e.target.value)}><option>All</option>{optionList("gender").map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Work Type<select value={draftWorkType} onChange={e => setDraftWorkType(e.target.value)}><option>All</option>{optionList("workType").map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Shift<select value={draftShift} onChange={e => setDraftShift(e.target.value)}><option>All</option>{optionList("shift").map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Designation<select value={draftDesignation} onChange={e => setDraftDesignation(e.target.value)}><option>All</option>{optionList("designation").map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Client Site<select value={draftSite} onChange={e => setDraftSite(e.target.value)}><option>All</option>{optionList("site").map(value => <option key={value}>{value}</option>)}</select></label>
        <button type="button" className="filter-apply-button" onClick={applyFilters}>Apply Filters</button>
      </div>
    </div>
    <div className="table-wrap"><table><thead><tr><th>GUARD ID</th><th>PHOTO & NAME</th><th>CONTACT</th><th>DESIGNATION</th><th>SITE DEPLOYED</th><th>SALARY</th><th>JOIN DATE</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{guards.map(g => <tr key={g.id}><td><span className="id-tag">{g.id}</span></td><td><button className="person-cell" onClick={() => onSelect(g)}><GuardPhoto path={g.photo} label={g.name} className="avatar" /><span><strong>{g.name}</strong><small>{g.gender} · DOB: {g.dob ? new Date(`${g.dob}T00:00:00`).toLocaleDateString("en-IN") : "—"}</small></span></button></td><td>{g.phone}<small className="cell-sub">{g.email || "—"}</small></td><td><span className="designation-tag">{g.designation}</span></td><td className="site-cell">{g.site || "Unassigned"}</td><td>₹{g.salary.toLocaleString("en-IN")}<small className="cell-sub">/mo</small></td><td>{new Date(`${g.joinDate}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td><td><span className={`status ${g.status.toLowerCase()}`}>{g.status}</span></td><td><div className="actions"><button title="View profile" onClick={() => onSelect(g)}>◉</button><button title={g.status === "Active" ? "Mark inactive" : "Activate"} onClick={() => onToggle(g)}>{g.status === "Active" ? "⏸" : "▶"}</button><button title="Delete" className="delete-action" onClick={() => onDelete(g)}>⌫</button></div></td></tr>)}{!guards.length && <tr><td colSpan={9} className="empty-state">No guards found. Try a different search or register a guard.</td></tr>}</tbody></table></div>
    <p className="table-foot">Showing {guards.length} of {allCount} guards · Select a guard name to view the complete profile</p>
  </div>;
}