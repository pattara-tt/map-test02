"use client";

import { useEffect, useState } from "react";
import { Btn, Card, Field, Input, Pill, SearchBar, Select, Status, Table, Textarea, Tiles, UCHead, useCollection, useStats } from "../ui";
import { ROLE_LABEL } from "../../lib/usecases";

// Actor: ฝ่ายดูแลระบบ — UC10–UC16
export default function AdminPanel({ uc, user }) {
  const [adminPage, setAdminPage] = useState(uc);

  useEffect(() => {
    setAdminPage(uc);
  }, [uc]);

  if (adminPage === "users") return <Users />;
  if (adminPage === "requests") {
    return (
      <Requests
        user={user}
        onReport={() => setAdminPage("report")}
        onQuota={() => setAdminPage("quota")}
      />
    );
  }

  if (adminPage === "quota") {
    return (
      <Quota
        user={user}
        onBack={() => setAdminPage("requests")}
      />
    );
  }

  if (adminPage === "report") {
    return (
      <RequestReport
        onBack={() => setAdminPage("requests")}
      />
    );
  }
  if (adminPage === "roles") return <Roles user={user} />;

  return <AccountStatus user={user} />;
}

// ── UC10 ค้นหาและเรียกดูข้อมูลผู้ใช้งาน ───────────────────
function Users() {
  const { items } = useCollection("users");
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const rows = items.filter((u) =>
    (!role || u.role === role) &&
    (u.name + u.email + u.username + u.institution).toLowerCase().includes(q.toLowerCase())
  );

  return (
    <>
      <h3>ค้นหาและเรียกดูข้อมูลผู้ใช้งาน</h3>
      <SearchBar value={q} onChange={setQ} placeholder="ค้นหาผู้ใช้งาน" />
      <Field label="กรองตามบทบาท">
        <Select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">ทั้งหมด</option>
          {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </Field>
      <div style={{ fontSize: 12, color: "#5F6368", margin: "2px 0 8px" }}>พบ {rows.length} รายการ</div>
      <Table
        columns={[
          { key: "id", label: "รหัส" },
          { key: "name", label: "ชื่อ", render: (u) => (<div><b>{u.name}</b><div style={{ fontSize: 11.5, color: "#5F6368" }}>@{u.username}</div></div>) },
          { key: "email", label: "อีเมล" },
          { key: "role", label: "บทบาท", render: (u) => <Pill>{ROLE_LABEL[u.role]}</Pill> },
          { key: "institution", label: "สถาบัน" },
          { key: "status", label: "สถานะ", render: (u) => <Status value={u.status} /> },
          { key: "createdAt", label: "วันที่สมัคร" },
        ]}
        rows={rows}
        empty="ไม่พบผู้ใช้งานตามเงื่อนไข"
      />
    </>
  );
}

// ── UC11 ค้นหาและเรียกดูข้อมูลคำร้อง ──────────────────────
function Requests({ user, onReport, onQuota }) {
  const { items, reload, destroy: destroyRequest } = useCollection("requests");
  const { items: users } = useCollection("users");
  const { items: rooms } = useCollection("rooms");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedRequest, setSelectedRequest] = useState(null);

  const rows = items
    .filter((r) => {
      if (r.status === "cancelled") return false;

      const user = users.find((u) => u.id === r.userId);

      return (
        (!status || r.status === status) &&
        (
          (r.id || "") +
          (r.subject || "") +
          (r.detail || "") +
          (user?.email || "") +
          (r.userId || "")
        ).toLowerCase().includes(q.toLowerCase())
      );
    })
    .sort((a, b) => {
      if (sortBy === "newest") {
        const dateCompare = String(b.createdAt || "").localeCompare(
          String(a.createdAt || "")
        );

        if (dateCompare !== 0) {
          return dateCompare;
        }

        return String(a.id || "").localeCompare(
          String(b.id || "")
        );
      }

      if (sortBy === "oldest") {
        const dateCompare = String(a.createdAt || "").localeCompare(
          String(b.createdAt || "")
        );

        if (dateCompare !== 0) {
          return dateCompare;
        }

        return String(a.id || "").localeCompare(
          String(b.id || "")
        );
      }

      if (sortBy === "id-asc") {
        return String(a.id || "").localeCompare(
          String(b.id || "")
        );
      }

      if (sortBy === "id-desc") {
        return String(b.id || "").localeCompare(
          String(a.id || "")
        );
      }

      return 0;
  });

  if (selectedRequest) {
    return (
      <RequestDetail
        request={selectedRequest}
        onBack={async () => {
          await reload();
          setSelectedRequest(null);
        }}
        user={user}
      />
    );
  }

  return (
    <>
      <h3>ค้นหาและเรียกดูข้อมูลคำร้อง</h3>

      <SearchBar
        value={q}
        onChange={setQ}
        placeholder="ค้นหาคำร้อง"
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <Field label="กรองตามสถานะ">
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">ทั้งหมด</option>
            <option value="pending">รอพิจารณา</option>
            <option value="approved">อนุมัติ</option>
            <option value="rejected">ไม่อนุมัติ</option>
          </Select>
        </Field>

        <Field label="เรียงลำดับ">
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="newest">วันที่ส่งล่าสุด</option>
            <option value="oldest">วันที่ส่งเก่าสุด</option>
            <option value="id-asc">เลขที่คำร้อง A → Z</option>
            <option value="id-desc">เลขที่คำร้อง Z → A</option>
          </Select>
        </Field>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <h3 style={{ margin: 0 }}>ค้นหาและเรียกดูข้อมูลคำร้อง</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn onClick={onQuota}>
            กำหนดจำนวนคำร้อง
          </Btn>

          <Btn onClick={onReport}>
            จัดทำสรุปคำร้อง
          </Btn>
        </div>
      </div>

      <Table 
        columns={[
          { key: "id", label: "เลขที่" },

          {
            key: "userId",
            label: "ผู้ยื่น",
            render: (r) => {
              const user = users.find((u) => u.id === r.userId);
              return user?.email || "-";
            },
          },

          { key: "subject", label: "หัวข้อ" },

          {
            key: "roomId",
            label: "สถานที่",
            render: (r) => {
              const room = rooms.find((room) => room.id === r.roomId);
              return room?.name || r.roomId || "-";
            },
          },

          { key: "createdAt", label: "วันที่ส่งคำร้อง" },

          {
            key: "status",
            label: "สถานะ",
            render: (r) => <Status value={r.status} />,
          },

          {
            key: "action",
            label: "การดำเนินการ",
            render: (r) => (
              <Btn onClick={() => setSelectedRequest(r)}>
                {r.status === "pending" ? "ตรวจสอบ" : "ดูรายละเอียด"}
              </Btn>
            ),
          },
        ]}
        rows={rows}
        empty="ไม่พบคำร้องตามเงื่อนไข"
      />
    </>
  );
}

// Selected Request page
function RequestDetail({ request, onBack, user }) {
  const { patch: patchRequest, destroy: destroyRequest } = useCollection("requests");
  const { items: users } = useCollection("users");
  const { patch: patchRoom } = useCollection("rooms");

  const [note, setNote] = useState(request.note || "");
  const [currentStatus, setCurrentStatus] = useState(request.status);
  const [currentReviewedBy, setCurrentReviewedBy] = useState(request.reviewedBy || "");
  const [currentReviewedAt, setCurrentReviewedAt] = useState(request.reviewedAt || "");

  const requestUser = users.find(
    (u) => u.id === request.userId
  );

  async function decide(status) {
    const reviewedBy = user?.id || "";
    const reviewedAt = new Date().toISOString().slice(0, 10);

    await patchRequest(
      request.id,
      {
        status,
        note,
        reviewedBy,
        reviewedAt,
      },
      user
    );

    if (status === "approved" && request.roomId && request.after) {
      await patchRoom(
        request.roomId,
        request.after,
        user
      );
    }

    setCurrentStatus(status);
    setCurrentReviewedBy(reviewedBy);
    setCurrentReviewedAt(reviewedAt);
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <Btn kind="ghost" onClick={onBack}>กลับ</Btn>

        <h3>
          ตรวจสอบคำร้อง {request.id}
        </h3>
      </div>

      {/* ข้อมูลคำร้อง */}
      <Card>
        <div style={{ marginBottom: 12 }}>
          <b>เลขที่:</b> {request.id}
        </div>

        <div style={{ marginBottom: 12 }}>
          <b>ผู้ยื่น:</b>{" "}
          {requestUser?.email || request.userId || "-"}
        </div>

        <div style={{ marginBottom: 12 }}>
          <b>หัวข้อ:</b> {request.subject || "-"}
        </div>

        <div style={{ marginBottom: 12 }}>
          <b>รายละเอียด:</b> {request.detail || "-"}
        </div>

        <div style={{ marginBottom: 12 }}>
          <b>วันที่ส่งคำร้อง:</b> {request.createdAt || "-"}
        </div>

        <div>
          <b>สถานะ:</b>{" "}
          <Status value={currentStatus} />
        </div>
      </Card>

      {/* เปรียบเทียบข้อมูลเดิมกับข้อมูลที่ขอแก้ไข */}
      <Card>
        <div
          style={{
            fontWeight: 800,
            fontSize: 14,
            marginBottom: 12,
          }}
        >
          ข้อมูลที่ขอแก้ไข
        </div>

        <div
          style={{
            border: "1px solid #DADCE0",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              background: "#F8F9FA",
              padding: "10px 12px",
              fontSize: 12,
              fontWeight: 800,
              color: "#5F6368",
            }}
          >
            <span>ข้อมูล</span>
            <span>ข้อมูลเดิม</span>
            <span>ข้อมูลที่ขอแก้ไข</span>
          </div>

          {Object.keys(request.after || {}).map((key) => {
            const oldValue = request.before?.[key];
            const newValue = request.after?.[key];

            return (
              <div
                key={key}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  padding: "10px 12px",
                  fontSize: 12.5,
                  borderTop: "1px solid #E8EAED",
                }}
              >
                <span>
                  {FIELD_LABEL[key] || key}
                </span>

                <span>
                  {oldValue ?? "-"}
                </span>

                <span
                  style={{
                    fontWeight:
                      oldValue !== newValue ? 700 : 400,
                  }}
                >
                  {newValue ?? "-"}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* การพิจารณา */}
      {currentStatus === "pending" ? (
        <Card>
          <div
            style={{
              fontWeight: 800,
              fontSize: 14,
              marginBottom: 12,
            }}
          >
            การพิจารณา
          </div>

          <Textarea
            placeholder="เหตุผลประกอบการพิจารณา"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ minHeight: 100 }}
          />

          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 12,
            }}
          >
            <Btn
              kind="danger"
              onClick={() => decide("rejected")}
            >
              ไม่อนุมัติ
            </Btn>

            <Btn
              kind="ok"
              onClick={() => decide("approved")}
            >
              อนุมัติ
            </Btn>
          </div>
        </Card>
      ) : (
        <Card>
          <div style={{ marginTop: 10 }}>
            <b>ผลการพิจารณา:</b>{" "}
            <Status value={currentStatus} />
          </div>
          <div>
            <b>เหตุผล:</b> {note || "-"}
          </div>
          <div style={{ marginTop: 10 }}>
            <b>ผู้พิจารณา: </b>
            {users.find((u) => u.id === currentReviewedBy)?.email || currentReviewedBy || "-"}
          </div>
          <div>
            <b>วันที่พิจารณา: </b>
            {currentReviewedAt || "-"}
          </div>
        </Card>
      )}
    </>
  );
}


// ── UC12 จัดการแก้ไขสิทธิ์ผู้ใช้งาน ───────────────────────
function Roles({ user }) {
  const { items, patch } = useCollection("users");
  const [q, setQ] = useState("");
  const rows = items.filter((u) => (u.name + u.email).toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <h3>จัดการแก้ไขสิทธิ์ผู้ใช้งาน</h3>
      <SearchBar value={q} onChange={setQ} placeholder="ค้นหาผู้ใช้ที่ต้องการแก้สิทธิ์" />
      {rows.map((u) => (
        <Card key={u.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div>
              <b style={{ fontSize: 14, color: "#202124" }}>{u.name}</b>
              <div style={{ fontSize: 11.5, color: "#5F6368" }}>{u.email} · {u.id}</div>
            </div>
            <Select value={u.role} onChange={(e) => patch(u.id, { role: e.target.value }, user)} style={{ width: 210 }}>
              {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </div>
        </Card>
      ))}
    </>
  );
}

// ชื่อ field ที่อาจถูกขอแก้ไข → label ภาษาไทยสำหรับแสดงผล
const FIELD_LABEL = {
  teacher: "อาจารย์ประจำ",
  capacity: "ความจุ",
  name: "ชื่อ",
  role: "บทบาท",
  status: "สถานะ",
  label: "ชื่อสถานที่",
};

// ── UC14 จัดทำสรุปคำร้อง ───────────────────────
function RequestReport({ onBack }) {
  const { items: requests, destroy: destroyRequest } = useCollection("requests");
  const { items: users } = useCollection("users");
  const { items: rooms } = useCollection("rooms");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [format, setFormat] = useState("pdf");

  const [selectedFields, setSelectedFields] = useState([
    "id",
    "applicant",
    "subject",
    "detail",
    "location",
    "createdAt",
    "status",
  ]);

  const [selectedRequests, setSelectedRequests] = useState({});

  const filteredRequests = requests.filter((r) => {
    if (r.status === "cancelled" && statusFilter !== "cancelled") {
      return false;
    }
    const keyword = search.trim().toLowerCase();

    const requestUser = users.find((u) => u.id === r.userId);

    const matchesSearch =
      !keyword ||
      (
        (r.id || "") +
        (r.subject || "") +
        (r.detail || "") +
        (r.userId || "") +
        (requestUser?.email || "")
      )
        .toLowerCase()
        .includes(keyword);

    const matchesStatus =
      !statusFilter || r.status === statusFilter;

    const matchesStartDate =
      !startDate || String(r.createdAt || "") >= startDate;

    const matchesEndDate =
      !endDate || String(r.createdAt || "") <= endDate;

    return (
      matchesSearch &&
      matchesStatus &&
      matchesStartDate &&
      matchesEndDate
    );
  });

  function clearFilters() {
    setStartDate("");
    setEndDate("");
    setSearch("");
    setStatusFilter("");
  }

  const allFilteredSelected =
    filteredRequests.length > 0 &&
    filteredRequests.every((r) => !!selectedRequests[r.id]);

  const someFilteredSelected =
    filteredRequests.some((r) => !!selectedRequests[r.id]);

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedRequests((prev) => {
        const next = { ...prev };

        filteredRequests.forEach((r) => {
          delete next[r.id];
        });

        return next;
      });
    } else {
      setSelectedRequests((prev) => {
        const next = { ...prev };

        filteredRequests.forEach((r) => {
          next[r.id] = true;
        });

        return next;
      });
    }
  }

  const FIELD_OPTIONS = [
    { key: "id", label: "เลขที่คำร้อง" },
    { key: "applicant", label: "ผู้ยื่น" },
    { key: "subject", label: "หัวข้อ" },
    { key: "detail", label: "รายละเอียด" },
    { key: "location", label: "สถานที่" },
    { key: "createdAt", label: "วันที่ส่งคำร้อง" },
    { key: "status", label: "สถานะ" },
    { key: "reviewer", label: "ผู้พิจารณา" },
    { key: "reviewedAt", label: "วันที่พิจารณา" },
    { key: "note", label: "เหตุผลประกอบการพิจารณา" },
    { key: "before", label: "ข้อมูลเดิม (Before)" },
    { key: "after", label: "ข้อมูลที่ขอแก้ไข (After)" },
  ];

  const FIELD_LABELS = {
    id: "เลขที่คำร้อง",
    applicant: "ผู้ยื่น",
    subject: "หัวข้อ",
    detail: "รายละเอียด",
    location: "สถานที่",
    createdAt: "วันที่ส่งคำร้อง",
    status: "สถานะ",
    reviewer: "ผู้พิจารณา",
    reviewedAt: "วันที่พิจารณา",
    note: "เหตุผลประกอบการพิจารณา",
    before: "ข้อมูลเดิม (Before)",
    after: "ข้อมูลที่ขอแก้ไข (After)",
  };

  const STATUS_LABELS = {
    pending: "รอพิจารณา",
    approved: "อนุมัติ",
    rejected: "ไม่อนุมัติ",
    cancelled: "ยกเลิกแล้ว",
  };

  const selectedRows = requests.filter(
    (r) => !!selectedRequests[r.id]
  );

  function formatChangedDataHTML(data) {
    if (!data) return "";

    if (typeof data !== "object") {
      return String(data);
    }

    return Object.entries(data)
      .map(([key, value]) => {
        const label = FIELD_LABEL[key] || key;

        if (value === null || value === undefined || value === "") {
          return `${label}: -`;
        }

        return `${label}: ${value}`;
      })
      .join("\n");
  }

  function formatChangedDataCsv(data) {
    if (!data) return "";

    if (typeof data !== "object") {
      return String(data);
    }

    return Object.entries(data)
      .map(([key, value]) => {
        const label = FIELD_LABEL[key] || key;

        if (value === null || value === undefined || value === "") {
          return `${label}: -`;
        }

        if (typeof value === "object") {
          return `${label}: ${JSON.stringify(value, null, 0)}`;
        }

        return `${label}: ${value}`;
      })
      .join(" | ");
  }

  function getExportValue(request, field) {
    const requestUser = users.find(
      (u) => u.id === request.userId
    );

    const room = rooms.find(
      (room) => room.id === request.roomId
    );

    const reviewer = users.find(
      (u) => u.id === request.reviewedBy
    );

    switch (field) {
      case "id":
        return request.id || "";

      case "applicant":
        return requestUser?.email || request.userId || "";

      case "subject":
        return request.subject || "";

      case "detail":
        return request.detail || "";

      case "location":
        return room?.name || request.roomId || "";

      case "createdAt":
        return request.createdAt || "";

      case "status":
        return STATUS_LABELS[request.status] || request.status || "";

      case "reviewer":
        return reviewer?.email || request.reviewedBy || "";

      case "reviewedAt":
        return request.reviewedAt || "";

      case "note":
        return request.note || "";

      case "before":
        return request.before || "";

      case "after":
        return request.after || "";

      default:
        return "";
    }
  }

  function escapeCsv(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
  }

  function exportCSV(rows) {
    const headers = selectedFields.map(
      (field) => FIELD_LABELS[field]
    );

    const csvRows = [
      headers,
      ...rows.map((request) =>
        selectedFields.map((field) => {
          const value = getExportValue(request, field);

          if (field === "before" || field === "after") {
            return formatChangedDataCsv(value).replace(/\n/g, " | ");
          }

          return value;
        })
      )
    ];

    const csv = "\uFEFF" + csvRows
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `request-report-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  function exportPDF(rows) {
    const body = rows
      .map(
        (request, index) => `
          <section class="request">
            <h2>รายการที่ ${index + 1}</h2>

            ${selectedFields
              .map(
                (field) => `
                  <div class="field">
                    <div class="label">
                      ${escapeHtml(FIELD_LABELS[field])}
                    </div>
                    <div class="value">
                      ${escapeHtml(
                        field === "before" || field === "after"
                        ? formatChangedDataHTML(getExportValue(request, field))
                        : getExportValue(request, field)
                      ).replace(/\n/g, "<br />")}
                    </div>
                  </div>
                `
              )
              .join("")}
          </section>
        `
      )
      .join("");

    const html = `
      <!DOCTYPE html>
      <html lang="th">
      <head>
        <meta charset="UTF-8" />
        <title>สรุปคำร้อง</title>

        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 25px;
            color: #202124;
            font-size: 13px;
            line-height: 1.6;
          }

          h1 {
            font-size: 22px;
            margin-bottom: 8px;
          }

          .meta {
            font-size: 12px;
            color: #5F6368;
            margin-bottom: 24px;
          }

          .request {
            border: 1px solid #DADCE0;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 15px;
            page-break-inside: avoid;
          }

          .request h2 {
            font-size: 16px;
            margin: 0 0 14px;
          }

          .field {
            margin-bottom: 10px;
          }

          .label {
            font-weight: 700;
            margin-bottom: 2px;
          }

          .value {
            white-space: normal;
            overflow-wrap: anywhere;
            word-break: break-word;
          }

          @media print {
            body {
              padding: 0;
            }

            .request {
              page-break-inside: avoid;
            }
          }
        </style>
      </head>

      <body>
        <h1>สรุปคำร้อง</h1>

        <div class="meta">
          ช่วงวันที่:
          ${startDate || "ทั้งหมด"}
          ถึง
          ${endDate || "ทั้งหมด"}
          |
          จำนวน ${rows.length} รายการ
        </div>

        ${body}
      </body>
      </html>
    `;

    const printWindow = window.open(
      "",
      "_blank",
      "width=1200,height=800"
    );

    if (!printWindow) {
      alert("ไม่สามารถเปิดหน้าสำหรับส่งออก PDF ได้");
      return;
    }

    printWindow.document.write(html);
    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function handleExport() {
    if (!selectedFields.length) {
      alert("กรุณาเลือกข้อมูลที่ต้องการส่งออก");
      return;
    }

    if (!selectedRows.length) {
      alert("กรุณาเลือกคำร้องที่ต้องการส่งออก");
      return;
    }

    if (format === "csv") {
      exportCSV(selectedRows);
    } else {
      exportPDF(selectedRows);
    }
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12
          }}
        >
          <Btn kind="ghost" onClick={onBack}>กลับ</Btn>

          <h3>
            จัดทำสรุปคำร้อง
          </h3>
        </div>
      </div>

      <Card>
        <div
          style={{
            fontWeight: 800,
            fontSize: 14,
            marginBottom: 12,
          }}
        >
          ประเภทไฟล์ที่ส่งออก
        </div>

        <div
          style={{
            display: "flex",
            gap: 24,
            alignItems: "center",
          }}
        >
          <label>
            <input
              type="radio"
              name="exportFormat"
              value="pdf"
              checked={format === "pdf"}
              onChange={(e) => setFormat(e.target.value)}
            />
            {" "}PDF
          </label>

          <label>
            <input
              type="radio"
              name="exportFormat"
              value="csv"
              checked={format === "csv"}
              onChange={(e) => setFormat(e.target.value)}
            />
            {" "}CSV
          </label>
        </div>
      </Card>
      {/* เลือกคำร้อง start here */}
      <Card>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 18,
          }}
        >
          <h4 style={{ margin: 0 }}>กำหนดข้อมูลคำร้อง</h4>

          <Btn kind="ghost" onClick={clearFilters}>
            ล้างตัวกรอง
          </Btn>
        </div>
        {/* ช่วงเวลา */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginBottom: 12,
          }}
        >
          <Field label="วันที่เริ่มต้น">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ width: "100%" }}
            />
          </Field>

          <Field label="วันที่สิ้นสุด">
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ width: "100%" }}
            />
          </Field>
        </div>

        {/* ค้นหา + กรองสถานะ */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginBottom: 20,
          }}
        >
          <Field label="ค้นหาคำร้อง">
            <Input
              type="text"
              placeholder="🔎 ค้นหาคำร้อง"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%" }}
            />
          </Field>

          <Field label="กรองตามสถานะ">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">ทุกสถานะ</option>
              <option value="pending">รอพิจารณา</option>
              <option value="approved">อนุมัติ</option>
              <option value="rejected">ไม่อนุมัติ</option>
            </Select>
          </Field>
        </div>

        {/* ตารางคำร้อง */}
        <Table
          columns={[
            {
              key: "select",
              label: (
                <Input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAll}
                  ref={(el) => {
                    if (el) {
                      el.indeterminate =
                        someFilteredSelected && !allFilteredSelected;
                    }
                  }}
                />
              ),
              render: (r) => (
                <Input
                  type="checkbox"
                  checked={!!selectedRequests[r.id]}
                  onChange={(e) => {
                    setSelectedRequests((prev) => ({
                      ...prev,
                      [r.id]: e.target.checked,
                    }));
                  }}
                />
              ),
            },
            { key: "id", label: "เลขที่" },

            {
              key: "userId",
              label: "ผู้ยื่น",
              render: (r) => {
                const requestUser = users.find(
                  (u) => u.id === r.userId
                );
                return requestUser?.email || "-";
              },
            },

            { key: "subject", label: "หัวข้อ" },

            {
              key: "roomId",
              label: "สถานที่",
              render: (r) => {
                const room = rooms.find(
                  (room) => room.id === r.roomId
                );
                return room?.name || r.roomId || "-";
              },
            },

            {
              key: "reviewedAt",
              label: "วันที่อนุมัติ",
              render: (r) => r.reviewedAt || "-",
            },

            {
              key: "reviewedBy",
              label: "อนุมัติโดย",
              render: (r) => {
                const reviewer = users.find(
                  (u) => u.id === r.reviewedBy
                );
                return reviewer?.email || r.reviewedBy || "-";
              },
            },

            {
              key: "status",
              label: "สถานะ",
              render: (r) => <Status value={r.status} />,
            },
          ]}
          rows={filteredRequests}
          empty="ไม่พบรายการคำร้อง"
        />

        <div
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: "1px solid #E8EAED",
          }}
        >
          <div
            style={{
              fontWeight: 800,
              fontSize: 14,
              marginBottom: 10,
            }}
          >
            ฟิลด์ที่ต้องการส่งออก
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 10,
            }}
          >
            {FIELD_OPTIONS.map((field) => (
              <label
                key={field.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                <Input
                  type="checkbox"
                  checked={selectedFields.includes(field.key)}
                  onChange={(e) => {
                    setSelectedFields((prev) =>
                      e.target.checked
                        ? [...prev, field.key]
                        : prev.filter(
                            (key) => key !== field.key
                          )
                    );
                  }}
                  style={{
                    width: "auto"
                  }}
                />

                {field.label}
              </label>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 10,
            marginTop: 20,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "#5F6368",
              marginRight: "auto",
            }}
          >
            เลือกแล้ว {selectedRows.length} รายการ
          </div>

          <Btn onClick={handleExport}>
            ส่งออก {format === "pdf" ? "PDF" : "CSV"}
          </Btn>
        </div>
      </Card>
      {/* เลือกคำร้อง end here */}
    </>
  );
}

// ── UC15 กำหนดจำนวนการส่งคำร้อง ──────────────────────────
function Quota({ user, onBack }) {
  const { items, patch, create } = useCollection("requestQuota");
  const q = items[0];
  const [form, setForm] = useState(null);
  const cur = form || q || { perUserPerDay: 3, perUserPerMonth: 20 };

  async function save() {
    const payload = { perUserPerDay: Number(cur.perUserPerDay), perUserPerMonth: Number(cur.perUserPerMonth), updatedAt: new Date().toISOString().slice(0, 10), updatedBy: user.id };
    if (q?.id) await patch(q.id, payload, user);
    else await create(payload, user);
    alert("บันทึกการตั้งค่าเรียบร้อย");
  }

  return (
    <>
    <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12
          }}
        >
          <Btn kind="ghost" onClick={onBack}>กลับ</Btn>
          <h3>กำหนดจำนวนการส่งคำร้อง</h3>
      </div>
      <Card>
        <Field label="จำนวนคำร้องสูงสุดต่อคน ต่อวัน">
          <Input type="number" min={1} value={cur.perUserPerDay} onChange={(e) => setForm({ ...cur, perUserPerDay: e.target.value })} />
        </Field>
        <Field label="จำนวนคำร้องสูงสุดต่อคน ต่อเดือน">
          <Input type="number" min={1} value={cur.perUserPerMonth} onChange={(e) => setForm({ ...cur, perUserPerMonth: e.target.value })} />
        </Field>
        <Btn onClick={save}>บันทึกการตั้งค่า</Btn>
        {q ? <div style={{ fontSize: 11.5, color: "#5F6368", marginTop: 9 }}>แก้ไขล่าสุด {q.updatedAt}</div> : null}
      </Card>
    </>
  );
}

// ── UC16 จัดการสถานะบัญชีของผู้ใช้งาน ────────────────────
function AccountStatus({ user }) {
  const { items, patch } = useCollection("users");
  const {items: requests, destroy: destroyRequest} = useCollection("requests");
  const [q, setQ] = useState("");
  const [suspending, setSuspending] = useState(null); // user object ที่กำลังจะระงับ
  const [reason, setReason] = useState("");

  const [restoring, setRestoring] = useState(null);
  const [restoreReason, setRestoreReason] = useState("");
  const rows = items.filter((u) => (u.name + u.email).toLowerCase().includes(q.toLowerCase()));

  async function confirmSuspend() {
    if (!reason.trim()) return alert("กรุณาระบุเหตุผลการระงับบัญชี");

    if (suspending.role === "user") {
      const userRequests = requests.filter(
        (request) => request.userId === suspending.id
      );

      for (const request of userRequests) {
        await destroyRequest(request.id, user);
      }
    }

    await patch(
      suspending.id,
      {
        status: "suspended",
        suspendReason: reason,
        suspendedAt: new Date().toISOString().slice(0, 10),
        suspendedBy: user.id
      },
      user
    );

    setSuspending(null);
    setReason("");
  }

  async function confirmRestore() {
    if (!restoreReason.trim()) {
      return alert("กรุณาระบุเหตุผลการคืนสิทธิ์");
    }

    try {
      const result = await patch(
        restoring.id,
        {
          status: "active",
          restoreReason: restoreReason,
          restoredAt: new Date().toISOString().slice(0, 10),
          restoredBy: user.id
        },
        user
      );

      console.log("RESTORE SUCCESS:", result);

      setRestoring(null);
      setRestoreReason("");
    } catch (error) {
      console.error("RESTORE ERROR:", error);
      alert(`คืนสิทธิ์ไม่สำเร็จ: ${error.message}`);
    }
  }

  return (
    <>
      <h3>จัดการสถานะบัญชีของผู้ใช้งาน</h3>
      <SearchBar value={q} onChange={setQ} placeholder="ค้นหาบัญชีผู้ใช้" />

      {suspending ? (
        <Card style={{ border: "1px solid #F5C2C0" }}>
          <b style={{ fontSize: 13.5, color: "#D93025" }}>ระงับบัญชี: {suspending.name}</b>
          <div style={{ fontSize: 12, color: "#5F6368", margin: "4px 0 10px" }}>{suspending.email}</div>
          <Field label="เหตุผลการระงับบัญชี">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ระบุเหตุผล เช่น ละเมิดข้อตกลงการใช้งาน" />
          </Field>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn kind="danger" onClick={confirmSuspend}>ยืนยันระงับบัญชี</Btn>
            <Btn kind="ghost" onClick={() => { setSuspending(null); setReason(""); }}>ยกเลิก</Btn>
          </div>
        </Card>
      ) : null}

      {restoring ? (
        <Card>
          <b>คืนสิทธิ์บัญชี: {restoring.name}</b>

          <div style={{ fontSize: 12, color: "#5F6368", margin: "4px 0 10px" }}>
            {restoring.email}
          </div>

          <Field label="เหตุผลการคืนสิทธิ์บัญชี">
            <Textarea
              value={restoreReason}
              onChange={(e) => setRestoreReason(e.target.value)}
              placeholder="ระบุเหตุผลการคืนสิทธิ์บัญชี"
            />
          </Field>

          <div style={{ display: "flex", gap: 8 }}>
            <Btn kind="ok" onClick={confirmRestore}>
              ยืนยันคืนสิทธิ์
            </Btn>

            <Btn
              kind="ghost"
              onClick={() => {
                setRestoring(null);
                setRestoreReason("");
              }}
            >
              ยกเลิก
            </Btn>
          </div>
        </Card>
      ) : null}

      <Table
        columns={[
          { key: "name", label: "ผู้ใช้", render: (u) => (<div><b>{u.name}</b><div style={{ fontSize: 11.5, color: "#5F6368" }}>{u.email}</div></div>) },
          { key: "role", label: "บทบาท", render: (u) => <Pill>{ROLE_LABEL[u.role]}</Pill> },
          { key: "status", label: "สถานะ", render: (u) => <Status value={u.status} /> },
          {
            key: "act", label: "",
            render: (u) => u.status === "active"
              ? <Btn kind="danger" onClick={() => { setSuspending(u); setReason(""); }}>ระงับบัญชี</Btn>
              : <Btn
                  kind="ok"
                  onClick={() => {
                    setRestoring(u);
                    setRestoreReason("");
                  }}
                >
                  คืนสิทธิ์
                </Btn>
          },
        ]}
        rows={rows}
      />
    </>
  );
}