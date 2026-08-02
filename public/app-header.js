(() => {
  if (window.__beastBitesHeaderLoaded) {
    return;
  }
  window.__beastBitesHeaderLoaded = true;

  const style = document.createElement("style");
  style.textContent = `
    .app-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 18px;
      padding: 14px 18px;
      border: 1px solid rgba(38, 48, 31, 0.12);
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.84);
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.06);
      backdrop-filter: blur(8px);
    }

    .app-header__brand {
      font-size: 18px;
      font-weight: 800;
      color: var(--green-dark, #3c5540);
      letter-spacing: 0.02em;
      white-space: nowrap;
    }

    .app-header__nav {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .app-header__link,
    .app-header__ghost {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 8px 12px;
      border-radius: 999px;
      border: 1px solid transparent;
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
      transition: 0.2s ease;
    }

    .app-header__link {
      background: rgba(83, 116, 87, 0.12);
      color: var(--green-dark, #3c5540);
      border-color: rgba(83, 116, 87, 0.18);
    }

    .app-header__link:hover {
      background: rgba(83, 116, 87, 0.2);
    }

    .app-header__link.is-active {
      background: var(--green, #537457);
      color: #fff;
      border-color: var(--green, #537457);
    }

    .app-header__ghost {
      background: rgba(194, 130, 63, 0.12);
      color: var(--amber, #c2823f);
      border-color: rgba(194, 130, 63, 0.2);
    }

    .app-header__user {
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(83, 116, 87, 0.08);
      color: var(--ink, #26301f);
      font-size: 13px;
      font-weight: 700;
      white-space: nowrap;
    }

    @media (max-width: 760px) {
      .app-header {
        padding: 12px 14px;
      }

      .app-header__nav {
        width: 100%;
      }

      .app-header__link,
      .app-header__ghost,
      .app-header__user {
        width: 100%;
      }
    }
  `;
  document.head.appendChild(style);

  const header = document.createElement("header");
  header.className = "app-header";
  header.innerHTML = `
    <div class="app-header__brand">Beast Bites</div>
    <nav class="app-header__nav" id="appHeaderNav"></nav>
    <div class="app-header__user" id="appHeaderUser">Loading...</div>
  `;
  document.body.prepend(header);

  const nav = header.querySelector("#appHeaderNav");
  const user = header.querySelector("#appHeaderUser");
  const currentPath = window.location.pathname;

  const navItemsFor = (data) => {
    const role = data?.user?.role;
    const caps = data?.capabilities || {};

    if (role === "Delivery-Guy") {
      return [
        { label: "Deliveries", href: "/dashboard/delivery" }
      ];
    }

    return [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Deliveries", href: "/dashboard/delivery" },
      ...(caps.canViewCustomers ? [{ label: "Customers", href: "/dashboard/customers" }] : []),
      ...(caps.canAddDelivery ? [{ label: "Add Delivery", href: "/dashboard/delivery/add" }] : []),
      ...(caps.canAddCustomer ? [{ label: "Add Customer", href: "/dashboard/customers/add" }] : []),
      ...(caps.canViewUsers ? [{ label: "Users", href: "/dashboard/users" }] : []),
      ...(caps.canViewLogs ? [{ label: "Logs", href: "/logs" }] : [])
    ];
  };

  const render = (data) => {
    const items = navItemsFor(data);
    nav.innerHTML = items.map((item) => {
      const isDeliveryDetailRoute = currentPath === "/delivery" || currentPath.startsWith("/delivery/");
      const isActive = currentPath === item.href || currentPath.startsWith(`${item.href}/`) || (item.href === "/dashboard/delivery" && isDeliveryDetailRoute);
      return `<a class="app-header__link${isActive ? " is-active" : ""}" href="${item.href}">${item.label}</a>`;
    }).join("");

    const username = data?.user?.username || "User";
    const role = data?.user?.role || "Unknown";
    user.textContent = `${username} (${role})`;
  };

  render({});

  fetch("/dashboard/data", { credentials: "include" })
    .then((response) => response.json())
    .then((data) => {
      if (data?.success) {
        render(data);
      } else {
        user.textContent = "Signed in";
      }
    })
    .catch(() => {
      user.textContent = "Signed in";
    });
})();
