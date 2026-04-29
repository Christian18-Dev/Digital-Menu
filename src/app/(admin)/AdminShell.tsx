"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { SocketConnectionProvider } from "@/lib/socket-connection";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const navItems = useMemo(
    () => [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/menus", label: "Menu" },
      { href: "/displays", label: "Display" },
    ],
    []
  );

  return (
    <SocketConnectionProvider>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <div className="flex min-h-screen w-full">
          <aside className="hidden w-80 shrink-0 border-r border-slate-200 bg-white px-6 py-8 md:block">
            <div className="card w-72 rounded-md bg-white px-5 pb-5 pt-2 shadow-md shadow-purple-200/50">
              <div className="px-1 flex justify-center">
                <img
                  src="/uploads/vgmenulogo.png"
                  alt="VGMenu"
                  className="h-32 w-auto mx-auto"
                  draggable={false}
                />
              </div>

              <nav className="mt-6">
                <ul className="w-full flex flex-col gap-2">
                  {navItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    const base =
                      "flex w-full items-center gap-4 rounded-full p-4 text-sm font-semibold text-slate-700 transition-all ease-linear hover:bg-purple-100 hover:shadow-inner focus:bg-gradient-to-r focus:from-purple-400 focus:to-purple-600 focus:text-white";
                    const active =
                      " bg-gradient-to-r from-purple-400 to-purple-600 text-white shadow-inner";
                    return (
                      <li
                        key={item.href}
                        className="flex items-center justify-center w-full whitespace-nowrap"
                      >
                        <Link
                          href={item.href}
                          aria-current={isActive ? "page" : undefined}
                          className={"group " + base + (isActive ? active : "")}
                        >
                          {item.href === "/dashboard" ? (
                            <svg
                              stroke="currentColor"
                              className="h-6 w-6 group-[aria-current=page]:fill-white group-[aria-current=page]:stroke-white"
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path d="M14,10V22H4a2,2,0,0,1-2-2V10Z" />
                              <path d="M22,10V20a2,2,0,0,1-2,2H16V10Z" />
                              <path d="M22,4V8H2V4A2,2,0,0,1,4,2H20A2,2,0,0,1,22,4Z" />
                            </svg>
                          ) : item.href === "/menus" ? (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              className="h-6 w-6"
                            >
                              <path
                                className="group-[aria-current=page]:stroke-white"
                                d="M6 4.5H18C19.1046 4.5 20 5.39543 20 6.5V17.5C20 18.6046 19.1046 19.5 18 19.5H7C5.34315 19.5 4 18.1569 4 16.5V6.5C4 5.39543 4.89543 4.5 6 4.5Z"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                              <path
                                className="group-[aria-current=page]:stroke-white"
                                d="M8 9H16"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                              <path
                                className="group-[aria-current=page]:stroke-white"
                                d="M8 13H16"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                              <path
                                className="group-[aria-current=page]:stroke-white"
                                d="M8 17H13"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                            </svg>
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              className="h-6 w-6"
                            >
                              <path
                                className="group-[aria-current=page]:fill-white"
                                fill="currentColor"
                                d="M4 6.5C4 5.67157 4.67157 5 5.5 5H18.5C19.3284 5 20 5.67157 20 6.5V14.5C20 15.3284 19.3284 16 18.5 16H13.25V18H15.5C16.0523 18 16.5 18.4477 16.5 19C16.5 19.5523 16.0523 20 15.5 20H8.5C7.94772 20 7.5 19.5523 7.5 19C7.5 18.4477 7.94772 18 8.5 18H10.75V16H5.5C4.67157 16 4 15.3284 4 14.5V6.5Z"
                              />
                            </svg>
                          )}
                          <span>{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}

                  <li className="mt-2 flex items-center justify-center w-full whitespace-nowrap">
                    <button
                      type="button"
                      disabled={isLoggingOut}
                      onClick={async () => {
                        if (isLoggingOut) return;
                        setIsLoggingOut(true);
                        try {
                          await fetch("/api/auth/logout", { method: "POST" });
                        } finally {
                          router.replace("/login");
                          router.refresh();
                          setIsLoggingOut(false);
                        }
                      }}
                      className="group flex w-full items-center gap-4 rounded-full p-4 text-sm font-semibold text-slate-700 transition-all ease-linear hover:bg-purple-100 hover:shadow-inner focus:bg-gradient-to-r focus:from-purple-400 focus:to-purple-600 focus:text-white disabled:opacity-60"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        className="h-6 w-6"
                      >
                        <path
                          className="group-focus:fill-white"
                          fill="currentColor"
                          d="M17.2929 14.2929C16.9024 14.6834 16.9024 15.3166 17.2929 15.7071C17.6834 16.0976 18.3166 16.0976 18.7071 15.7071L21.6201 12.7941C21.6351 12.7791 21.6497 12.7637 21.6637 12.748C21.87 12.5648 22 12.2976 22 12C22 11.7024 21.87 11.4352 21.6637 11.252C21.6497 11.2363 21.6351 11.2209 21.6201 11.2059L18.7071 8.29289C18.3166 7.90237 17.6834 7.90237 17.2929 8.29289C16.9024 8.68342 16.9024 9.31658 17.2929 9.70711L18.5858 11H13C12.4477 11 12 11.4477 12 12C12 12.5523 12.4477 13 13 13H18.5858L17.2929 14.2929Z"
                        />
                        <path
                          className="group-focus:fill-white"
                          fill="currentColor"
                          d="M5 2C3.34315 2 2 3.34315 2 5V19C2 20.6569 3.34315 22 5 22H14.5C15.8807 22 17 20.8807 17 19.5V16.7326C16.8519 16.647 16.7125 16.5409 16.5858 16.4142C15.9314 15.7598 15.8253 14.7649 16.2674 14H13C11.8954 14 11 13.1046 11 12C11 10.8954 11.8954 10 13 10H16.2674C15.8253 9.23514 15.9314 8.24015 16.5858 7.58579C16.7125 7.4591 16.8519 7.35296 17 7.26738V4.5C17 3.11929 15.8807 2 14.5 2H5Z"
                        />
                      </svg>
                      <span>{isLoggingOut ? "Logging out..." : "Logout"}</span>
                    </button>
                  </li>
                </ul>
              </nav>
            </div>
          </aside>

          {isMobileNavOpen && (
            <div className="fixed inset-0 z-40 md:hidden">
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setIsMobileNavOpen(false)}
                className="absolute inset-0 bg-slate-900/40"
              />
              <aside className="absolute left-0 top-0 h-full w-80 border-r border-slate-200 bg-white px-6 py-8 shadow-lg">
                <div className="flex items-center justify-between">
                  <img
                    src="/uploads/vgmenulogo.png"
                    alt="VGMenu"
                    className="h-14 w-auto mx-auto"
                    draggable={false}
                  />
                  <button
                    type="button"
                    onClick={() => setIsMobileNavOpen(false)}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-700 shadow-sm"
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-6 card w-72 rounded-md bg-white px-5 pb-5 pt-2 shadow-md shadow-purple-200/50">
                  <div className="px-1">
                  </div>

                  <nav className="mt-6">
                    <ul className="w-full flex flex-col gap-2">
                      {navItems.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                        const base =
                          "flex w-full items-center gap-4 rounded-full p-4 text-sm font-semibold text-slate-700 transition-all ease-linear hover:bg-purple-100 hover:shadow-inner focus:bg-gradient-to-r focus:from-purple-400 focus:to-purple-600 focus:text-white";
                        const active =
                          " bg-gradient-to-r from-purple-400 to-purple-600 text-white shadow-inner";
                        return (
                          <li
                            key={item.href}
                            className="flex items-center justify-center w-full whitespace-nowrap"
                          >
                            <Link
                              href={item.href}
                              onClick={() => setIsMobileNavOpen(false)}
                              aria-current={isActive ? "page" : undefined}
                              className={"group " + base + (isActive ? active : "")}
                            >
                              {item.href === "/dashboard" ? (
                                <svg
                                  stroke="currentColor"
                                  className="h-6 w-6 group-[aria-current=page]:fill-white group-[aria-current=page]:stroke-white"
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                >
                                  <path d="M14,10V22H4a2,2,0,0,1-2-2V10Z" />
                                  <path d="M22,10V20a2,2,0,0,1-2,2H16V10Z" />
                                  <path d="M22,4V8H2V4A2,2,0,0,1,4,2H20A2,2,0,0,1,22,4Z" />
                                </svg>
                              ) : item.href === "/menus" ? (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  className="h-6 w-6"
                                >
                                  <path
                                    className="group-[aria-current=page]:stroke-white"
                                    d="M6 4.5H18C19.1046 4.5 20 5.39543 20 6.5V17.5C20 18.6046 19.1046 19.5 18 19.5H7C5.34315 19.5 4 18.1569 4 16.5V6.5C4 5.39543 4.89543 4.5 6 4.5Z"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                  />
                                  <path
                                    className="group-[aria-current=page]:stroke-white"
                                    d="M8 9H16"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                  />
                                  <path
                                    className="group-[aria-current=page]:stroke-white"
                                    d="M8 13H16"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                  />
                                  <path
                                    className="group-[aria-current=page]:stroke-white"
                                    d="M8 17H13"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                  />
                                </svg>
                              ) : (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  className="h-6 w-6"
                                >
                                  <path
                                    className="group-[aria-current=page]:fill-white"
                                    fill="currentColor"
                                    d="M4 6.5C4 5.67157 4.67157 5 5.5 5H18.5C19.3284 5 20 5.67157 20 6.5V14.5C20 15.3284 19.3284 16 18.5 16H13.25V18H15.5C16.0523 18 16.5 18.4477 16.5 19C16.5 19.5523 16.0523 20 15.5 20H8.5C7.94772 20 7.5 19.5523 7.5 19C7.5 18.4477 7.94772 18 8.5 18H10.75V16H5.5C4.67157 16 4 15.3284 4 14.5V6.5Z"
                                  />
                                </svg>
                              )}
                              <span>{item.label}</span>
                            </Link>
                          </li>
                        );
                      })}

                      <li className="mt-2 flex items-center justify-center w-full whitespace-nowrap">
                        <button
                          type="button"
                          disabled={isLoggingOut}
                          onClick={async () => {
                            if (isLoggingOut) return;
                            setIsLoggingOut(true);
                            try {
                              await fetch("/api/auth/logout", { method: "POST" });
                            } finally {
                              setIsMobileNavOpen(false);
                              router.replace("/login");
                              router.refresh();
                              setIsLoggingOut(false);
                            }
                          }}
                          className="group flex w-full items-center gap-4 rounded-full p-4 text-sm font-semibold text-slate-700 transition-all ease-linear hover:bg-purple-100 hover:shadow-inner focus:bg-gradient-to-r focus:from-purple-400 focus:to-purple-600 focus:text-white disabled:opacity-60"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            className="h-6 w-6"
                          >
                            <path
                              className="group-focus:fill-white"
                              fill="currentColor"
                              d="M17.2929 14.2929C16.9024 14.6834 16.9024 15.3166 17.2929 15.7071C17.6834 16.0976 18.3166 16.0976 18.7071 15.7071L21.6201 12.7941C21.6351 12.7791 21.6497 12.7637 21.6637 12.748C21.87 12.5648 22 12.2976 22 12C22 11.7024 21.87 11.4352 21.6637 11.252C21.6497 11.2363 21.6351 11.2209 21.6201 11.2059L18.7071 8.29289C18.3166 7.90237 17.6834 7.90237 17.2929 8.29289C16.9024 8.68342 16.9024 9.31658 17.2929 9.70711L18.5858 11H13C12.4477 11 12 11.4477 12 12C12 12.5523 12.4477 13 13 13H18.5858L17.2929 14.2929Z"
                            />
                            <path
                              className="group-focus:fill-white"
                              fill="currentColor"
                              d="M5 2C3.34315 2 2 3.34315 2 5V19C2 20.6569 3.34315 22 5 22H14.5C15.8807 22 17 20.8807 17 19.5V16.7326C16.8519 16.647 16.7125 16.5409 16.5858 16.4142C15.9314 15.7598 15.8253 14.7649 16.2674 14H13C11.8954 14 11 13.1046 11 12C11 10.8954 11.8954 10 13 10H16.2674C15.8253 9.23514 15.9314 8.24015 16.5858 7.58579C16.7125 7.4591 16.8519 7.35296 17 7.26738V4.5C17 3.11929 15.8807 2 14.5 2H5Z"
                            />
                          </svg>
                          <span>{isLoggingOut ? "Logging out..." : "Logout"}</span>
                        </button>
                      </li>
                    </ul>
                  </nav>
                </div>
              </aside>
          </div>
        )}

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4 shadow-sm md:hidden">
              <div className="relative flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setIsMobileNavOpen(true)}
                  className="absolute left-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                </button>
                <div className="flex items-center gap-3">
                  <img
                    src="/uploads/vgmenulogo.png"
                    alt="VGMenu"
                    className="h-8 w-auto"
                    draggable={false}
                  />
                </div>
              </div>
            </header>

            <main className="flex-1 px-6 py-8">{children}</main>
          </div>
        </div>
      </div>
    </SocketConnectionProvider>
  );
}
