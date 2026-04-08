import { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Upload, Check, AlertCircle } from 'lucide-react';
import api from '../lib/api';
import { Card, Button, LoadingSpinner, Select } from '../components/ui';
import { useSnackbar } from '../components/ui/Snackbar';

const PRICEBOOK_FIELDS = [
  { value: 'skip', label: '— Skip —' },
  { value: 'name', label: 'Name *' },
  { value: 'price', label: 'Price *' },
  { value: 'description', label: 'Description' },
  { value: 'category', label: 'Category' },
  { value: 'sku', label: 'SKU' },
];

const CUSTOMER_FIELDS = [
  { value: 'skip', label: '— Skip —' },
  { value: 'first_name', label: 'First Name *' },
  { value: 'last_name', label: 'Last Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'address', label: 'Address' },
  { value: 'city', label: 'City' },
  { value: 'state', label: 'State' },
  { value: 'zip', label: 'ZIP' },
];

export default function ImportWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type') || 'pricebook';
  const { showSnack } = useSnackbar();

  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [mappings, setMappings] = useState({});
  const [categories, setCategories] = useState({});
  const [duplicateAction, setDuplicateAction] = useState(null);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);
  const dropRef = useRef(null);

  const fieldOptions = type === 'pricebook' ? PRICEBOOK_FIELDS : CUSTOMER_FIELDS;
  const requiredFields = type === 'pricebook' ? ['name', 'price'] : ['first_name'];

  function handleFileDrop(e) {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', type);
      const res = await api.post('/import/preview', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setPreview(res.data);
      const initialMappings = {};
      (res.data.columns || []).forEach((col, i) => {
        initialMappings[col] = res.data.column_mappings?.[i] || 'skip';
      });
      setMappings(initialMappings);
      if (type === 'pricebook') {
        const cats = {};
        (res.data.items || []).forEach(item => {
          cats[item.name] = res.data.category_guesses?.[item.name] || '';
        });
        setCategories(cats);
      }
      setStep(2);
    } catch {
      showSnack('Failed to parse file', 'error');
    } finally {
      setLoading(false);
    }
  }

  function requiredMapped() {
    return requiredFields.every(f => Object.values(mappings).includes(f));
  }

  async function handleImport(dupAction) {
    setLoading(true);
    try {
      const res = await api.post('/import/execute', {
        type,
        file_id: preview?.file_id,
        mappings,
        categoryAssignments: type === 'pricebook' ? categories : undefined,
        duplicateAction: dupAction || 'skip',
      });
      setResult(res.data);
      setStep(4);
    } catch {
      showSnack('Import failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  function handleStep3Continue() {
    if ((preview?.duplicate_count || 0) > 0) {
      setStep('dup');
    } else {
      handleImport('skip');
    }
  }

  const backTo = type === 'pricebook' ? '/pricebook' : '/customers';

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(backTo)} className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">
          Import {type === 'pricebook' ? 'Pricebook' : 'Customers'}
        </h1>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-1 mb-6">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className={`flex-1 h-1.5 rounded-full transition-colors ${step >= s ? 'bg-[#1A73E8]' : 'bg-gray-200'}`} />
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="space-y-4">
          <Card>
            <div
              ref={dropRef}
              onDrop={handleFileDrop}
              onDragOver={e => e.preventDefault()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-[#1A73E8] transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={36} className="mx-auto text-gray-400 mb-3" />
              {file ? (
                <p className="font-medium text-gray-900">{file.name}</p>
              ) : (
                <>
                  <p className="font-medium text-gray-700">Drop your file here or click to browse</p>
                  <p className="text-sm text-gray-400 mt-1">Supports .csv, .xlsx, .xls, .tsv</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.tsv"
                className="hidden"
                onChange={e => setFile(e.target.files[0])}
              />
            </div>
          </Card>
          <Button onClick={handleUpload} loading={loading} disabled={!file} className="w-full">
            Analyze File
          </Button>
        </div>
      )}

      {/* Step 2: Map columns */}
      {step === 2 && preview && (
        <div className="space-y-4">
          <Card>
            <p className="font-semibold text-gray-900 mb-1">Map Your Columns</p>
            {preview.claude_notes && (
              <div className="bg-blue-50 rounded-xl p-3 mb-4 text-sm text-blue-800">{preview.claude_notes}</div>
            )}
            <div className="space-y-2">
              {(preview.columns || []).map(col => (
                <div key={col} className="flex items-center gap-3">
                  <p className="flex-1 text-sm font-medium text-gray-700 truncate">{col}</p>
                  <span className="text-gray-400">→</span>
                  <div className="flex-1">
                    <Select
                      value={mappings[col] || 'skip'}
                      onChange={e => setMappings(p => ({ ...p, [col]: e.target.value }))}
                      options={fieldOptions}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
          {!requiredMapped() && (
            <div className="flex items-center gap-2 text-amber-600 text-sm">
              <AlertCircle size={16} />
              Required fields not yet mapped: {requiredFields.filter(f => !Object.values(mappings).includes(f)).join(', ')}
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="outlined" onClick={() => setStep(1)} className="flex-1">Back</Button>
            <Button onClick={() => setStep(3)} disabled={!requiredMapped()} className="flex-1">Continue</Button>
          </div>
        </div>
      )}

      {/* Step 3: Categories (pricebook only) */}
      {step === 3 && type === 'pricebook' && (
        <div className="space-y-4">
          <Card>
            <p className="font-semibold text-gray-900 mb-3">Assign Categories</p>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {Object.keys(categories).slice(0, 50).map(name => (
                <div key={name} className="flex items-center gap-3">
                  <p className="flex-1 text-sm text-gray-700 truncate">{name}</p>
                  <input
                    value={categories[name]}
                    onChange={e => setCategories(p => ({ ...p, [name]: e.target.value }))}
                    placeholder="Category"
                    className="w-36 rounded-xl border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] min-h-[36px]"
                  />
                </div>
              ))}
            </div>
          </Card>
          <div className="flex gap-3">
            <Button variant="outlined" onClick={() => setStep(2)} className="flex-1">Back</Button>
            <Button onClick={handleStep3Continue} className="flex-1">Continue</Button>
          </div>
        </div>
      )}

      {/* Step 3: For customers, skip categories */}
      {step === 3 && type === 'customers' && (() => { handleStep3Continue(); return null; })()}

      {/* Duplicate handling */}
      {step === 'dup' && (
        <Card>
          <p className="font-semibold text-gray-900 mb-2">Duplicate Items Found</p>
          <p className="text-gray-600 mb-4">{preview?.duplicate_count} items may already exist. How should we handle them?</p>
          <div className="flex gap-3">
            <Button variant="outlined" onClick={() => handleImport('skip')} loading={loading} className="flex-1">Skip Duplicates</Button>
            <Button onClick={() => handleImport('update')} loading={loading} className="flex-1">Update Existing</Button>
          </div>
        </Card>
      )}

      {/* Step 4: Complete */}
      {step === 4 && result && (
        <div className="text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <Check size={40} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Import Complete!</h2>
          <div className="grid grid-cols-2 gap-3">
            <Card><p className="text-2xl font-bold text-gray-900">{result.imported || 0}</p><p className="text-sm text-gray-500">Imported</p></Card>
            <Card><p className="text-2xl font-bold text-gray-900">{result.updated || 0}</p><p className="text-sm text-gray-500">Updated</p></Card>
            <Card><p className="text-2xl font-bold text-gray-900">{result.skipped || 0}</p><p className="text-sm text-gray-500">Skipped</p></Card>
            <Card><p className="text-2xl font-bold text-gray-900">{result.errors || 0}</p><p className="text-sm text-gray-500">Errors</p></Card>
          </div>
          {result.error_list?.length > 0 && (
            <Card>
              <p className="text-sm font-medium text-red-600 mb-2">Errors:</p>
              {result.error_list.slice(0, 10).map((e, i) => (
                <p key={i} className="text-xs text-gray-500">{e}</p>
              ))}
            </Card>
          )}
          <Button onClick={() => navigate(backTo)} className="w-full">Done</Button>
        </div>
      )}

      {loading && step !== 1 && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4">
            <LoadingSpinner />
            <p className="text-gray-700 font-medium">Processing...</p>
          </div>
        </div>
      )}
    </div>
  );
}
