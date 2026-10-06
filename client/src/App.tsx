import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Toaster } from './components/Toaster'
import LoadingSpinner from './components/LoadingSpinner'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Employees = lazy(() => import('./pages/Employees'))
const Departments = lazy(() => import('./pages/Departments'))
const Attendance = lazy(() => import('./pages/Attendance'))
const Leave = lazy(() => import('./pages/Leave'))
const Tasks = lazy(() => import('./pages/Tasks'))
const Calendar = lazy(() => import('./pages/Calendar'))
const OrgChart = lazy(() => import('./pages/OrgChart'))
const Documents = lazy(() => import('./pages/Documents'))
const Settings = lazy(() => import('./pages/Settings'))
const Admin = lazy(() => import('./pages/Admin'))
const LeaveBalance = lazy(() => import('./pages/LeaveBalance'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const NotFound = lazy(() => import('./pages/NotFound'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <Routes>
              <Route
                path="/login"
                element={
                  <ErrorBoundary>
                    <Login />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/register"
                element={
                  <ErrorBoundary>
                    <Register />
                  </ErrorBoundary>
                }
              />
              <Route
                path="/forgot-password"
                element={
                  <ErrorBoundary>
                    <ForgotPassword />
                  </ErrorBoundary>
                }
              />
              <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                  <Route
                    path="/dashboard"
                    element={
                      <ErrorBoundary>
                        <Dashboard />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/employees"
                    element={
                      <ErrorBoundary>
                        <Employees />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/departments"
                    element={
                      <ErrorBoundary>
                        <Departments />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/attendance"
                    element={
                      <ErrorBoundary>
                        <Attendance />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/leave"
                    element={
                      <ErrorBoundary>
                        <Leave />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/tasks"
                    element={
                      <ErrorBoundary>
                        <Tasks />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/calendar"
                    element={
                      <ErrorBoundary>
                        <Calendar />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/org-chart"
                    element={
                      <ErrorBoundary>
                        <OrgChart />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/documents"
                    element={
                      <ErrorBoundary>
                        <Documents />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/leave-balance"
                    element={
                      <ErrorBoundary>
                        <LeaveBalance />
                      </ErrorBoundary>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <ErrorBoundary>
                        <Settings />
                      </ErrorBoundary>
                    }
                  />
                  <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                    <Route
                      path="/admin"
                      element={
                        <ErrorBoundary>
                          <Admin />
                        </ErrorBoundary>
                      }
                    />
                  </Route>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                </Route>
              </Route>
              <Route
                path="*"
                element={
                  <ErrorBoundary>
                    <NotFound />
                  </ErrorBoundary>
                }
              />
            </Routes>
          </Suspense>
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
