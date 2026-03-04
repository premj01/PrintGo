import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, MapPin, Phone } from "lucide-react";

export default function ContactPage() {
    return (
        <div className="min-h-[calc(100vh-10rem)] bg-background px-4 py-16">
            <div className="mx-auto max-w-2xl animate-fade-in">
                <div className="mb-12 text-center">
                    <h1 className="text-3xl font-bold text-foreground">Contact Us</h1>
                    <p className="mt-2 text-muted-foreground">
                        Get in touch with the PrintGo team
                    </p>
                </div>

                <div className="grid gap-6">
                    <Card className="shadow-md transition-all hover:shadow-lg">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/15">
                                    <Mail className="h-5 w-5 text-success" />
                                </div>
                                Email
                            </CardTitle>
                            <CardDescription>
                                Send us an email and we&apos;ll get back to you within 24 hours
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button variant="outline" asChild>
                                <a href="mailto:support@printgo.io">support@printgo.io</a>
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="shadow-md transition-all hover:shadow-lg">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/30">
                                    <MapPin className="h-5 w-5 text-foreground" />
                                </div>
                                Location
                            </CardTitle>
                            <CardDescription>
                                Visit us at our office
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                Available for deployment across campuses, offices, and public spaces.
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="shadow-md transition-all hover:shadow-lg">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/15">
                                    <Phone className="h-5 w-5 text-success" />
                                </div>
                                Phone
                            </CardTitle>
                            <CardDescription>
                                Call us during business hours
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                Monday - Friday, 9:00 AM - 6:00 PM
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
