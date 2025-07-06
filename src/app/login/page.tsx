
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { ChefHat, LogIn, AlertTriangle } from 'lucide-react';

function ConfigurationErrorCard() {
    return (
        <Card className="w-full max-w-lg border-destructive bg-destructive/10">
            <CardHeader>
                <CardTitle className="font-headline text-2xl flex items-center text-destructive">
                    <AlertTriangle className="mr-3 h-8 w-8" />
                    Firebase Not Configured
                </CardTitle>
                <CardDescription className="text-destructive/90 pt-1">
                    The application cannot connect to Firebase because it's missing its configuration keys. This is an environment setup issue.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm font-medium">To fix this, you must:</p>
                <ol className="list-decimal list-inside space-y-3 text-sm bg-background/50 p-4 rounded-md border border-dashed">
                    <li>
                        In your project's root directory, create a file named: <br />
                        <code className="bg-muted px-2 py-1 rounded text-base font-semibold">.env.local</code>
                    </li>
                    <li>
                        Add your Firebase project credentials to this file. The variable names must start with <code className="bg-muted px-1.5 py-0.5 rounded">NEXT_PUBLIC_</code>.
                    </li>
                    <li className="font-bold">
                        After saving the file, you MUST stop and restart the development server for the changes to apply.
                    </li>
                </ol>
            </CardContent>
            <CardFooter>
                 <p className="text-xs text-muted-foreground">The application code is working as expected, but it needs these keys to function.</p>
            </CardFooter>
        </Card>
    );
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfigError, setIsConfigError] = useState(false); // New state for config error
  const { signIn, signUp, user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && user) {
      router.push('/');
    }
  }, [user, loading, router]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Attempting sign-in. Firebase config being used:', auth.app.options);
    setIsSubmitting(true);
    try {
      await signIn(auth, email, password);
      toast({ title: "Signed In!", description: "Welcome back!" });
      router.push('/');
    } catch (error: any) {
      console.error("Sign in error", error);
      if (error.code === 'auth/configuration-not-found') {
        setIsConfigError(true);
        toast({
          title: "Firebase Configuration Error",
          description: "Could not find valid Firebase credentials. Please check your .env.local file and restart the server.",
          variant: "destructive",
          duration: 10000,
        });
      } else {
        toast({ title: "Sign In Failed", description: error.message || "Please check your credentials.", variant: "destructive" });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Attempting sign-up. Firebase config being used:', auth.app.options);
    setIsSubmitting(true);
    try {
      await signUp(auth, email, password);
      toast({ title: "Account Created!", description: "Welcome to DinnerTime! Please sign in." });
    } catch (error: any)
      {
      console.error("Sign up error", error);
      if (error.code === 'auth/configuration-not-found') {
        setIsConfigError(true);
        toast({
          title: "Firebase Configuration Error",
          description: "Could not find valid Firebase credentials. Please check your .env.local file and restart the server.",
          variant: "destructive",
          duration: 10000,
        });
      } else {
        toast({ title: "Sign Up Failed", description: error.message || "Could not create account.", variant: "destructive" });
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (loading || (!loading && user)) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <ChefHat className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-xl font-headline">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      { isConfigError ? (
        <ConfigurationErrorCard />
      ) : (
        <>
          <div className="flex items-center justify-center mb-8">
            <ChefHat className="mr-4 h-12 w-12 md:h-16 md:w-16 text-primary" />
            <h1 className="text-5xl md:text-6xl font-headline text-primary">
              DinnerTime
            </h1>
          </div>
          <Tabs defaultValue="signin" className="w-full max-w-md">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <Card>
                <CardHeader>
                  <CardTitle className="font-headline text-2xl flex items-center">
                    <LogIn className="mr-2 h-6 w-6 opacity-70" />
                    Sign In
                  </CardTitle>
                  <CardDescription>Enter your credentials to access your meal planner.</CardDescription>
                </CardHeader>
                <form onSubmit={handleSignIn}>
                  <CardContent className="space-y-4">
                    <div className="space-y-1">
                      <Label htmlFor="email-signin">Email</Label>
                      <Input id="email-signin" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="password-signin">Password</Label>
                      <Input id="password-signin" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? 'Signing In...' : 'Sign In'}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </TabsContent>
            <TabsContent value="signup">
              <Card>
                <CardHeader>
                  <CardTitle className="font-headline text-2xl">Create Account</CardTitle>
                  <CardDescription>Sign up to save and sync your meal plans.</CardDescription>
                </CardHeader>
                <form onSubmit={handleSignUp}>
                  <CardContent className="space-y-4">
                    <div className="space-y-1">
                      <Label htmlFor="email-signup">Email</Label>
                      <Input id="email-signup" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="password-signup">Password</Label>
                      <Input id="password-signup" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Choose a strong password" required />
                      <p className="text-xs text-muted-foreground">Password should be at least 6 characters.</p>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? 'Creating Account...' : 'Create Account'}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </TabsContent>
          </Tabs>
          <p className="mt-8 text-xs text-muted-foreground">
            For now, data is stored locally. Cloud sync will be enabled in a future update after login.
          </p>
        </>
      )}
    </div>
  );
}
