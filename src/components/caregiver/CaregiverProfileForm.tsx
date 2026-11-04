import React, { useState } from "react";
import { CircleAlert, Save } from "lucide-react";
import { ServerError } from "@/components/auth/ServerError";
import { AvailabilityPicker } from "@/components/caregiver/AvailabilityPicker";
import { GminaPicker, type SelectedGmina } from "@/components/caregiver/GminaPicker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sortAvailability, type AvailabilitySlot } from "@/lib/availability";
import { cn } from "@/lib/utils";
import { formatPlPhone, normalizePlPhone } from "@/lib/phone";
import type { OwnCaregiverProfileDto, SaveCaregiverProfileCommand, ServiceDto } from "@/types";

const DISPLAY_NAME_MIN = 2;
const DISPLAY_NAME_MAX = 60;
const DESCRIPTION_MAX = 1000;
const GENERIC_ERROR = "Nie udało się zapisać profilu. Spróbuj ponownie za chwilę.";

type Field = "displayName" | "description" | "phone" | "email" | "gminas" | "services" | "availability";
type FieldErrors = Partial<Record<Field, string>>;

interface Props {
  initialProfile: OwnCaregiverProfileDto | null;
  services: ServiceDto[];
  accountEmail: string;
}

interface ErrorResponse {
  error?: string;
  fieldErrors?: Record<string, string>;
}

const inputClass =
  "rounded-lg border-white/20 bg-white/10 text-white placeholder:text-white/40 focus-visible:ring-purple-400";
const invalidInputClass = "border-red-400/60 focus-visible:ring-red-400";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 flex items-center gap-1 text-xs text-red-300">
      <CircleAlert className="size-3 shrink-0" />
      {message}
    </p>
  );
}

export default function CaregiverProfileForm({ initialProfile, services, accountEmail }: Props) {
  const [displayName, setDisplayName] = useState(initialProfile?.displayName ?? "");
  const [description, setDescription] = useState(initialProfile?.description ?? "");
  const [phone, setPhone] = useState(initialProfile?.contact.phone ? formatPlPhone(initialProfile.contact.phone) : "");
  // A new profile starts with the account e-mail as the contact address; an existing one keeps what was saved.
  const [email, setEmail] = useState(initialProfile ? (initialProfile.contact.email ?? "") : accountEmail);
  const [selectedServices, setSelectedServices] = useState<string[]>(initialProfile?.services.map((s) => s.slug) ?? []);
  const [gminas, setGminas] = useState<SelectedGmina[]>(initialProfile?.gminas ?? []);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>(initialProfile?.availability ?? []);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function clearError(field: Field) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate() {
    const next: FieldErrors = {};

    const name = displayName.trim();
    if (!name) {
      next.displayName = "Podaj imię.";
    } else if (name.length < DISPLAY_NAME_MIN || name.length > DISPLAY_NAME_MAX) {
      next.displayName = `Imię musi mieć od ${DISPLAY_NAME_MIN} do ${DISPLAY_NAME_MAX} znaków.`;
    }

    if (phone.trim() && !normalizePlPhone(phone)) {
      next.phone = "Podaj polski numer telefonu (9 cyfr)";
    }

    if (gminas.some((g) => !g.active)) {
      next.gminas = "Usuń wycofane gminy, zanim zapiszesz profil.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function toggleService(slug: string, checked: boolean) {
    setSelectedServices((prev) => (checked ? [...prev, slug] : prev.filter((s) => s !== slug)));
    clearError("services");
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    if (!validate()) {
      setFormError("Popraw zaznaczone pola.");
      return;
    }

    // PUT replaces the whole profile, so every field is sent, empty ones as null or [].
    const command: SaveCaregiverProfileCommand = {
      displayName: displayName.trim(),
      description: description.trim() || null,
      phone: phone.trim() ? normalizePlPhone(phone) : null,
      email: email.trim() || null,
      gminas: gminas.map((g) => g.teryt),
      // Catalogue order, regardless of the order the boxes were ticked in.
      services: services.filter((s) => selectedServices.includes(s.slug)).map((s) => s.slug),
      availability: sortAvailability(availability),
    };

    setSubmitting(true);
    try {
      const response = await fetch("/api/caregiver/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      });

      if (response.ok) {
        window.location.assign("/profil");
        return;
      }
      if (response.status === 401) {
        window.location.assign("/auth/signin");
        return;
      }
      if (response.status === 400) {
        const body = (await response.json().catch(() => ({}))) as ErrorResponse;
        setErrors(body.fieldErrors ?? {});
        setFormError(body.error ?? GENERIC_ERROR);
      } else {
        setFormError(GENERIC_ERROR);
      }
    } catch {
      setFormError(GENERIC_ERROR);
    }
    setSubmitting(false);
  }

  return (
    <form className="space-y-5" onSubmit={(e) => void handleSubmit(e)} noValidate>
      <div>
        <Label htmlFor="displayName" className="mb-1 font-normal text-blue-100/80">
          Imię
        </Label>
        <Input
          id="displayName"
          name="displayName"
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value);
            clearError("displayName");
          }}
          maxLength={DISPLAY_NAME_MAX}
          autoComplete="given-name"
          placeholder="np. Anna"
          aria-invalid={errors.displayName ? true : undefined}
          aria-describedby={errors.displayName ? "displayName-error" : undefined}
          className={cn(inputClass, errors.displayName && invalidInputClass)}
        />
        <FieldError id="displayName-error" message={errors.displayName} />
      </div>

      <div>
        <Label htmlFor="description" className="mb-1 font-normal text-blue-100/80">
          O mnie <span className="text-blue-100/50">(opcjonalnie)</span>
        </Label>
        <Textarea
          id="description"
          name="description"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            clearError("description");
          }}
          maxLength={DESCRIPTION_MAX}
          rows={4}
          placeholder="Doświadczenie, kwalifikacje, w jakich godzinach możesz pomagać"
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={errors.description ? "description-hint description-error" : "description-hint"}
          className={cn(inputClass, errors.description && invalidInputClass)}
        />
        <div className="mt-1 flex items-start justify-between gap-3 text-xs text-blue-100/50">
          <p id="description-hint">Opis jest widoczny publicznie — nie wpisuj tu telefonu ani e-maila.</p>
          <p className="shrink-0">
            {description.length} / {DESCRIPTION_MAX}
          </p>
        </div>
        <FieldError id="description-error" message={errors.description} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="phone" className="mb-1 font-normal text-blue-100/80">
            Telefon
          </Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              clearError("phone");
            }}
            autoComplete="tel"
            placeholder="np. 600 100 200"
            aria-invalid={errors.phone ? true : undefined}
            aria-describedby={errors.phone ? "phone-error" : undefined}
            className={cn(inputClass, errors.phone && invalidInputClass)}
          />
          <FieldError id="phone-error" message={errors.phone} />
        </div>

        <div>
          <Label htmlFor="email" className="mb-1 font-normal text-blue-100/80">
            E-mail kontaktowy
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearError("email");
            }}
            autoComplete="email"
            placeholder="ty@example.com"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "email-error" : undefined}
            className={cn(inputClass, errors.email && invalidInputClass)}
          />
          <FieldError id="email-error" message={errors.email} />
        </div>
      </div>

      <p className="-mt-2 text-xs text-blue-100/50">Telefon i e-mail nie są pokazywane publicznie.</p>

      <fieldset aria-describedby={errors.services ? "services-error" : undefined}>
        <legend className="mb-2 text-sm text-blue-100/80">Usługi, które oferujesz</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {services.map((service) => {
            const checked = selectedServices.includes(service.slug);
            return (
              <Label
                key={service.slug}
                htmlFor={`service-${service.slug}`}
                className={cn(
                  "cursor-pointer items-start gap-3 rounded-lg border bg-white/5 px-3 py-2.5 leading-snug font-normal text-white transition-colors hover:bg-white/10",
                  checked ? "border-purple-400" : "border-white/20",
                )}
              >
                <Checkbox
                  id={`service-${service.slug}`}
                  checked={checked}
                  onCheckedChange={(state) => {
                    toggleService(service.slug, state === true);
                  }}
                  className="mt-0.5 border-white/40 data-[state=checked]:border-purple-400 data-[state=checked]:bg-purple-500 data-[state=checked]:text-white"
                />
                <span>{service.label}</span>
              </Label>
            );
          })}
        </div>
        <FieldError id="services-error" message={errors.services} />
      </fieldset>

      <div>
        <Label htmlFor="gminas" className="mb-1 font-normal text-blue-100/80">
          Gminy, w których pracujesz
        </Label>
        <GminaPicker
          id="gminas"
          value={gminas}
          onChange={(next) => {
            setGminas(next);
            clearError("gminas");
          }}
          invalid={Boolean(errors.gminas)}
          describedBy={errors.gminas ? "gminas-error" : undefined}
        />
        <FieldError id="gminas-error" message={errors.gminas} />
      </div>

      <fieldset>
        <legend className="mb-1 text-sm text-blue-100/80">
          Kiedy możesz pomagać <span className="text-blue-100/50">(opcjonalnie)</span>
        </legend>
        <p id="availability-hint" className="mb-2 text-xs text-blue-100/50">
          Noc oznacza godziny 22–6 zaczynające się danego dnia.
        </p>
        <AvailabilityPicker
          value={availability}
          onChange={(next) => {
            setAvailability(next);
            clearError("availability");
          }}
          describedBy={errors.availability ? "availability-hint availability-error" : "availability-hint"}
        />
        <FieldError id="availability-error" message={errors.availability} />
      </fieldset>

      <ServerError message={formError} />

      <Button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-500"
      >
        {submitting ? (
          <span className="flex items-center gap-2">
            <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Zapisywanie...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Save className="size-4" />
            Zapisz profil
          </span>
        )}
      </Button>
    </form>
  );
}
