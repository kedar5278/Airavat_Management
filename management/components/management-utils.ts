import type { Guard } from "./management-types";

export const today = () => new Date().toISOString().slice(0, 10);

export const rowToGuard = (g: Record<string, unknown>): Guard => ({
  id: String(g.id),
  name: String(g.name),
  phone: String(g.phone),
  email: String(g.email ?? ""),
  aadhaar: String(g.aadhaar),
  gender: String(g.gender),
  dob: String(g.dob),
  address: String(g.address),
  designation: String(g.designation),
  site: String(g.site ?? ""),
  salary: Number(g.salary),
  joinDate: String(g.join_date),
  status: g.status === "Inactive" ? "Inactive" : "Active",
  shift: String(g.shift),
  workType: String(g.work_type),
  photo: typeof g.photo_path === "string" ? g.photo_path : undefined,
});

export const guardToRow = (g: Guard) => ({
  id: g.id,
  name: g.name,
  phone: g.phone,
  email: g.email,
  aadhaar: g.aadhaar,
  gender: g.gender,
  dob: g.dob,
  address: g.address,
  designation: g.designation,
  site: g.site,
  salary: g.salary,
  join_date: g.joinDate,
  status: g.status,
  shift: g.shift,
  work_type: g.workType,
  photo_path: g.photo ?? null,
});