
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CheckSquare, UserRound, ArrowLeft } from 'lucide-react';
import { MagneticButton } from '@/components/landing/MagneticButton';
import { GrainOverlay } from '@/components/landing/GrainOverlay';

interface AuthProps {
  defaultMode?: 'signin' | 'signup';
}

const Auth: React.FC<AuthProps> = ({ defaultMode = 'signin' }) => {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(defaultMode === 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn, signUp, signInAnonymously, signInWithGoogle } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = isSignUp 
        ? await signUp(email, password)
        : await signIn(email, password);

      if (error) {
        setError(error.message);
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <GrainOverlay />
      {/* Ambient mesh-gradient backdrop only, no interactive 3D: a login
          form's job is speed and clarity, not spectacle. Monochrome removed
          the amber tint this used to carry, so opacity is tuned up slightly
          from the original values to read as a deliberate, restrained glow
          rather than an accidental smudge once desaturated. */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-foreground/[0.09] rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-foreground/[0.05] rounded-full blur-3xl" />
        <div className="absolute top-[35%] left-[40%] w-72 h-72 bg-foreground/[0.04] rounded-full blur-3xl" />
      </div>

      <button
        onClick={() => navigate('/')}
        className="fixed top-5 left-5 sm:top-6 sm:left-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors z-10"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <Card className="w-full max-w-sm border-border rounded-2xl shadow-xl relative">
        <CardHeader className="text-center pb-2">
          <div className="w-10 h-10 bg-foreground rounded-xl flex items-center justify-center mx-auto mb-3">
            <CheckSquare className="w-5 h-5 text-background" />
          </div>
          <CardTitle className="text-xl font-bold text-foreground font-grotesk">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </CardTitle>
          <CardDescription>
            {isSignUp ? 'Start free, no credit card needed.' : 'Sign in to keep going where you left off.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full"
                minLength={6}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <MagneticButton type="submit" disabled={loading} className="w-full" strength={0.15}>
              {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
            </MagneticButton>
          </form>
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {isSignUp
                ? 'Already have an account? Sign in'
                : "Don't have an account? Sign up"}
            </button>
          </div>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-wide">
                <span className="bg-card px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full mt-4"
              disabled={googleLoading}
              onClick={async () => {
                setGoogleLoading(true);
                setError(null);
                try {
                  const { error } = await signInWithGoogle();
                  if (error) setError(error.message);
                } catch {
                  setError('Failed to sign in with Google');
                } finally {
                  setGoogleLoading(false);
                }
              }}
            >
              {googleLoading ? 'Redirecting...' : 'Continue with Google'}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full mt-4"
              disabled={guestLoading}
              onClick={async () => {
                setGuestLoading(true);
                setError(null);
                try {
                  const { error } = await signInAnonymously();
                  if (error) {
                    setError(error.message);
                  }
                } catch (err) {
                  setError('Failed to continue as guest');
                } finally {
                  setGuestLoading(false);
                }
              }}
            >
              <UserRound className="w-4 h-4 mr-2" />
              {guestLoading ? 'Loading...' : 'Continue as Guest'}
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              No account needed. You can create one later.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
