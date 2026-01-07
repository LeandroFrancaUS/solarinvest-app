# UI Changes Guide

## Form Layout Improvements

### Before
The "Endereço de instalação da UC geradora" field was using inconsistent styling with extra whitespace:

```tsx
<Field label="Endereço do Contratante">
  <input ... />
</Field>
<div>  <!-- Extra wrapper causing spacing issues -->
  <div className="mb-1 text-sm font-medium text-gray-600 leasing-location-label">
    <span className="leasing-field-label-text">
      Endereço de instalação da UC geradora
    </span>
    <label className="leasing-location-checkbox flex items-center gap-2">
      <CheckboxSmall ... />
      <span>Mesmo que endereço do contratante</span>
    </label>
  </div>
  <input ... />
  <p className="mt-1 text-xs text-gray-500">  <!-- Extra paragraph causing spacing -->
    Endereço onde a UC geradora será instalada...
  </p>
</div>
```

### After
Now using consistent `Field` component structure with proper spacing:

```tsx
<Field label="Endereço do Contratante">
  <input ... />
</Field>
<Field
  label={
    <div className="leasing-location-label">
      <span className="leasing-field-label-text">
        Endereço de instalação da UC geradora
      </span>
      <label className="leasing-location-checkbox flex items-center gap-2">
        <CheckboxSmall ... />
        <span>Mesmo que endereço do contratante</span>
      </label>
    </div>
  }
  hint="Endereço onde a UC geradora será instalada (pode ser diferente do endereço do contratante)"
>
  <input ... />
</Field>
```

## Visual Impact

### Spacing
- **Before**: Extra whitespace between "Endereço do Contratante" and "Endereço de instalação da UC geradora"
- **After**: Consistent spacing using the same Field component structure as other form fields

### Layout
- **Before**: Inconsistent field structure (Field component vs div wrapper)
- **After**: All address fields use the same Field component for consistency

### Hint Text
- **Before**: Separate paragraph element with custom styling (`mt-1 text-xs text-gray-500`)
- **After**: Uses Field's built-in `hint` prop with consistent `cfg-help` class

## Expected Visual Result

The form should now have:
1. ✅ Consistent vertical spacing between all fields
2. ✅ Proper alignment of labels
3. ✅ No extra whitespace between address fields
4. ✅ Helper text styled consistently across all fields
5. ✅ Checkbox control properly aligned with label

## Testing the UI

To verify the changes:

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to the leasing contract section

3. Look for the client address fields:
   - "Endereço do Contratante"
   - "Endereço de instalação da UC geradora"

4. Verify:
   - [ ] No extra spacing between these two fields
   - [ ] Fields are aligned consistently
   - [ ] Checkbox "Mesmo que endereço do contratante" is properly positioned
   - [ ] Helper text styling matches other fields

## Form Behavior

The functionality remains the same:
- User can enter contractor address
- User can enter UC generator installation address separately
- Checkbox allows copying contractor address to UC generator address field
- Both addresses are sent separately in the contract payload
