
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { UserRound, ArrowLeft } from 'lucide-react';

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
  const [error, setError] = useState<string | null>(null);
  const { signIn, signUp, signInAnonymously } = useAuth();

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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border relative">
        <CardHeader className="text-center">
          <button 
            onClick={() => navigate('/')}
            className="absolute top-4 left-4 p-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <CardTitle className="text-2xl font-bold text-foreground">Monotask</CardTitle>
          <CardDescription>
            {isSignUp ? 'Create your account' : 'Sign in to your account'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full"
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full"
                minLength={6}
              />
            </div>
            {error && (
              <div className="text-sm text-red-600 text-center">{error}</div>
            )}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white hover:bg-gray-800"
            >
              {loading ? 'Loading...' : (isSignUp ? 'Sign Up' : 'Sign In')}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-muted-foreground hover:text-foreground"
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
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or</span>
              </div>
            </div>

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
