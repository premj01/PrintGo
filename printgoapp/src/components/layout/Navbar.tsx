import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { useAuth, useTheme } from "@/hooks";
import { NAV_LINKS } from "@/config/constants";
import { buildGoogleOAuthUrl } from "@/config/env";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Menu, LogOut, User, Printer, Sun, Moon } from "lucide-react";

export default function Navbar() {
    const { user, isAuthenticated, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);

    const handleLogin = () => {
        window.location.href = buildGoogleOAuthUrl();
    };

    const handleLogout = () => {
        logout();
    };

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <nav className="sticky top-0 z-50 border-b border-border/40 bg-navbar/95 backdrop-blur supports-[backdrop-filter]:bg-navbar/60 transition-colors duration-300">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                {/* Brand */}
                <Link
                    to="/"
                    className="flex items-center gap-2 text-xl font-bold text-text-primary transition-opacity hover:opacity-80"
                >
                    <Printer className="h-6 w-6" />
                    <span>PrintGo</span>
                </Link>

                {/* Desktop Nav Links */}
                <div className="hidden items-center gap-1 md:flex">
                    {NAV_LINKS.map((link) => (
                        <Button
                            key={link.href}
                            variant={location.pathname === link.href ? "secondary" : "ghost"}
                            asChild
                            size="sm"
                        >
                            <Link to={link.href}>{link.label}</Link>
                        </Button>
                    ))}
                </div>

                {/* Desktop: Theme Toggle + Auth / Profile */}
                <div className="hidden items-center gap-2 md:flex">
                    {/* Theme Toggle */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleTheme}
                        className="h-9 w-9 transition-transform hover:scale-110"
                        aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
                    >
                        {theme === "light" ? (
                            <Moon className="h-[1.2rem] w-[1.2rem] transition-all" />
                        ) : (
                            <Sun className="h-[1.2rem] w-[1.2rem] transition-all" />
                        )}
                    </Button>

                    {isAuthenticated && user ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    className="relative h-9 w-9 rounded-full"
                                >
                                    <Avatar className="h-9 w-9">
                                        <AvatarImage src={user.picture} alt={user.name} />
                                        <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56" align="end" forceMount>
                                <DropdownMenuLabel className="font-normal">
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-sm font-medium leading-none">
                                            {user.name}
                                        </p>
                                        <p className="text-xs leading-none text-muted-foreground">
                                            {user.email}
                                        </p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleLogout}>
                                    <LogOut className="mr-2 h-4 w-4" />
                                    <span>Log out</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <Button
                            onClick={handleLogin}
                            variant="default"
                            size="sm"
                            className="bg-success text-white hover:bg-success/90"
                        >
                            Sign In
                        </Button>
                    )}
                </div>

                {/* Mobile: Theme Toggle + Menu Trigger */}
                <div className="flex items-center gap-1 md:hidden">
                    {/* Mobile Theme Toggle */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleTheme}
                        className="h-9 w-9"
                        aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
                    >
                        {theme === "light" ? (
                            <Moon className="h-5 w-5" />
                        ) : (
                            <Sun className="h-5 w-5" />
                        )}
                    </Button>

                    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <Menu className="h-5 w-5" />
                                <span className="sr-only">Toggle menu</span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="w-72">
                            <SheetHeader>
                                <SheetTitle className="flex items-center gap-2">
                                    <Printer className="h-5 w-5" />
                                    PrintGo
                                </SheetTitle>
                            </SheetHeader>
                            <div className="mt-6 flex flex-col gap-2">
                                {NAV_LINKS.map((link) => (
                                    <Button
                                        key={link.href}
                                        variant={
                                            location.pathname === link.href ? "secondary" : "ghost"
                                        }
                                        className="justify-start"
                                        asChild
                                        onClick={() => setMobileOpen(false)}
                                    >
                                        <Link to={link.href}>{link.label}</Link>
                                    </Button>
                                ))}

                                <Separator className="my-2" />

                                {isAuthenticated && user ? (
                                    <>
                                        <div className="flex items-center gap-3 px-3 py-2">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={user.picture} alt={user.name} />
                                                <AvatarFallback>
                                                    {getInitials(user.name)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium">{user.name}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {user.email}
                                                </span>
                                            </div>
                                        </div>
                                        <Button
                                            variant="outline"
                                            className="justify-start"
                                            onClick={() => {
                                                handleLogout();
                                                setMobileOpen(false);
                                            }}
                                        >
                                            <LogOut className="mr-2 h-4 w-4" />
                                            Log out
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        onClick={() => {
                                            handleLogin();
                                            setMobileOpen(false);
                                        }}
                                        className="bg-success text-white hover:bg-success/90"
                                    >
                                        <User className="mr-2 h-4 w-4" />
                                        Sign In
                                    </Button>
                                )}
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </nav>
    );
}
