"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface ProviderOption {
  id: string;
  label: string;
  configured: boolean;
  models: { id: string; label: string }[];
}

/**
 * A single dropdown for picking "provider + model" together, grouped by
 * provider. Unconfigured providers are shown (so users can see what's
 * available) but their models are disabled.
 */
export function ModelSelector({
  providers,
  value,
  onChange,
  disabled,
}: {
  providers: ProviderOption[];
  value: { provider: string; model: string } | null;
  onChange: (value: { provider: string; model: string }) => void;
  disabled?: boolean;
}) {
  const selected = value ? `${value.provider}::${value.model}` : undefined;

  return (
    <Select
      value={selected}
      onValueChange={(next) => {
        const [provider, model] = next.split("::");
        onChange({ provider, model });
      }}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Choose a model" />
      </SelectTrigger>
      <SelectContent>
        {providers.map((provider) => (
          <SelectGroup key={provider.id}>
            <SelectLabel>
              {provider.label}
              {!provider.configured ? " (not configured)" : ""}
            </SelectLabel>
            {provider.models.map((model) => (
              <SelectItem
                key={model.id}
                value={`${provider.id}::${model.id}`}
                disabled={!provider.configured}
              >
                {model.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
