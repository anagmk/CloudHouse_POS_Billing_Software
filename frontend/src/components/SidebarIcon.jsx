const shapes = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  inventory: (
    <>
      <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z" />
      <path d="m4.5 7.8 7.5 4.3 7.5-4.3M12 12v8.5" />
    </>
  ),
  products: (
    <>
      <path d="M5 4.5h14v15H5z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  categories: (
    <>
      <path d="M4 5h16M4 12h16M4 19h16" />
      <circle cx="7" cy="5" r="1" />
      <circle cx="7" cy="12" r="1" />
      <circle cx="7" cy="19" r="1" />
    </>
  ),
  suppliers: (
    <>
      <path d="M3 7h11v11H3zM14 11h4l3 3v4h-7z" />
      <circle cx="7.5" cy="19" r="2" />
      <circle cx="17.5" cy="19" r="2" />
      <path d="M6 10h5" />
    </>
  ),
  orders: (
    <>
      <path d="M7 4H5v17h14V4h-2" />
      <path d="M9 3h6v4H9zM8 12h8M8 16h6" />
    </>
  ),
  customers: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20v-1.5a5.5 5.5 0 0 1 11 0V20zM16 5.5a3 3 0 0 1 0 5.8M17 14a5 5 0 0 1 3.5 4.8V20" />
    </>
  ),
  staff: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20v-1.5a5.5 5.5 0 0 1 11 0V20zM16 11a3 3 0 1 0-1.2-5.8M17 15a5 5 0 0 1 3.5 4.8V20" />
    </>
  ),
  purchases: (
    <>
      <path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L21 8H6" />
      <circle cx="10" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
    </>
  ),
  expenses: (
    <>
      <path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </>
  ),
  ledger: (
    <>
      <path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v18H7.5A2.5 2.5 0 0 1 5 17.5z" />
      <path d="M5 5v13M9 7h7M9 11h7M9 15h5" />
    </>
  ),
  payments: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M7 15h4" />
    </>
  ),
  reports: (
    <>
      <path d="M4 20V11M10 20V5M16 20v-7M22 20H2" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="m19.4 15 .1.1 1.4 1.1-1.5 2.6-1.7-.7a8 8 0 0 1-1.5.9l-.3 1.8h-3l-.3-1.8a8 8 0 0 1-1.5-.9l-1.7.7-1.5-2.6 1.4-1.1a7 7 0 0 1 0-1.8l-1.4-1.1 1.5-2.6 1.7.7a8 8 0 0 1 1.5-.9l.3-1.8h3l.3 1.8a8 8 0 0 1 1.5.9l1.7-.7 1.5 2.6-1.4 1.1a7 7 0 0 1 0 1.8z" />
    </>
  ),
  billing: (
    <>
      <path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L21 8H6" />
      <circle cx="10" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
      <path d="M12 7v5M9.5 9.5h5" />
    </>
  ),
  transactions: (
    <>
      <path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </>
  ),
  returns: (
    <>
      <path d="M4 10a8 8 0 1 1 1 6" />
      <path d="M4 4v6h6" />
    </>
  ),
};

export default function SidebarIcon({ name, className = "h-4 w-4" }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {shapes[name] || shapes.products}
    </svg>
  );
}
