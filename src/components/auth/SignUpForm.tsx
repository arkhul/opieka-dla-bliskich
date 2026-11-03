import React, { useState } from "react";
import { CircleAlert, Mail, Lock, UserPlus } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { PasswordToggle } from "@/components/auth/PasswordToggle";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import type { AccountRole } from "@/types";

const MIN_PASSWORD_LENGTH = 6;

const ROLE_OPTIONS: { value: AccountRole; label: string }[] = [
  { value: "caregiver", label: "Oferuję opiekę — jestem opiekunem" },
  { value: "coordinator", label: "Szukam opieki dla bliskiej osoby — koordynator" },
];

interface Props {
  serverError?: string | null;
}

// Polish plural of "znak" for the few counts the hint can show (1-5).
function charactersLabel(count: number) {
  if (count === 1) return "znak";
  if (count >= 2 && count <= 4) return "znaki";
  return "znaków";
}

export default function SignUpForm({ serverError }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<AccountRole | "">("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string; role?: string }>(
    {},
  );

  function validate() {
    const next: typeof errors = {};

    if (!role) {
      next.role = "Wybierz, czy oferujesz opiekę, czy jej szukasz";
    }

    if (!email.trim()) {
      next.email = "Podaj adres e-mail";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = "Podaj poprawny adres e-mail";
    }

    if (!password) {
      next.password = "Podaj hasło";
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      next.password = `Hasło musi mieć co najmniej ${MIN_PASSWORD_LENGTH} znaków`;
    }

    if (!confirmPassword) {
      next.confirmPassword = "Powtórz hasło";
    } else if (password !== confirmPassword) {
      next.confirmPassword = "Hasła nie są takie same";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function clearError(field: keyof typeof errors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!validate()) {
      e.preventDefault();
    }
  }

  const missingCharacters = MIN_PASSWORD_LENGTH - password.length;
  const passwordHint =
    !errors.password && password.length > 0 && missingCharacters > 0 ? (
      <p className="mt-1 text-xs text-blue-100/50">
        Brakuje jeszcze {missingCharacters} {charactersLabel(missingCharacters)}
      </p>
    ) : undefined;

  return (
    <form method="POST" action="/api/auth/signup" className="space-y-4" onSubmit={handleSubmit} noValidate>
      <div>
        <p id="role-label" className="mb-2 block text-sm text-blue-100/80">
          Kim jesteś?
        </p>
        <RadioGroup
          name="role"
          value={role}
          onValueChange={(v) => {
            setRole(v as AccountRole);
            clearError("role");
          }}
          aria-labelledby="role-label"
          aria-invalid={errors.role ? true : undefined}
          className="gap-2"
        >
          {ROLE_OPTIONS.map((option) => (
            <Label
              key={option.value}
              htmlFor={`role-${option.value}`}
              className={cn(
                "cursor-pointer items-start gap-3 rounded-lg border bg-white/5 px-3 py-3 leading-snug font-normal text-white transition-colors hover:bg-white/10",
                role === option.value ? "border-purple-400" : "border-white/20",
                errors.role && "border-red-400/60",
              )}
            >
              <RadioGroupItem
                id={`role-${option.value}`}
                value={option.value}
                className="mt-0.5 border-white/40 text-purple-300 [&_svg]:fill-purple-300"
              />
              <span>{option.label}</span>
            </Label>
          ))}
        </RadioGroup>
        {errors.role && (
          <p className="mt-1 flex items-center gap-1 text-xs text-red-300">
            <CircleAlert className="size-3" />
            {errors.role}
          </p>
        )}
      </div>

      <FormField
        id="email"
        type="email"
        label="E-mail"
        value={email}
        onChange={(v) => {
          setEmail(v);
          clearError("email");
        }}
        placeholder="ty@example.com"
        error={errors.email}
        icon={<Mail className="size-4" />}
      />

      <FormField
        id="password"
        label="Hasło"
        type={showPassword ? "text" : "password"}
        value={password}
        onChange={(v) => {
          setPassword(v);
          clearError("password");
        }}
        placeholder="Min. 6 znaków"
        error={errors.password}
        hint={passwordHint}
        icon={<Lock className="size-4" />}
        endContent={
          <PasswordToggle
            visible={showPassword}
            onToggle={() => {
              setShowPassword(!showPassword);
            }}
          />
        }
      />

      <FormField
        id="confirmPassword"
        name="confirmPassword"
        label="Powtórz hasło"
        type={showConfirmPassword ? "text" : "password"}
        value={confirmPassword}
        onChange={(v) => {
          setConfirmPassword(v);
          clearError("confirmPassword");
        }}
        placeholder="Wpisz hasło ponownie"
        error={errors.confirmPassword}
        icon={<Lock className="size-4" />}
        endContent={
          <PasswordToggle
            visible={showConfirmPassword}
            onToggle={() => {
              setShowConfirmPassword(!showConfirmPassword);
            }}
          />
        }
      />

      <ServerError message={serverError} />

      <SubmitButton pendingText="Tworzenie konta..." icon={<UserPlus className="size-4" />}>
        Załóż konto
      </SubmitButton>
    </form>
  );
}
