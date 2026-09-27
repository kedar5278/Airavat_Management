export type Guard = { id: string; name: string; phone: string; email: string; aadhaar: string; gender: string; dob: string; address: string; designation: string; site: string; salary: number; joinDate: string; status: "Active" | "Inactive"; shift: string; workType: string; photo?: string };
export type Invoice = { id: string; client: string; amount: number; date: string; status: string; description: string };
export type Attendance = Record<string, Record<string, "Present" | "Absent" | "Leave">>;
export type View = "Dashboard" | "Guard List" | "Register Guard" | "Attendance" | "Invoices";