'use client';

import { useEffect, useState } from 'react';
import { useAppSelector } from '../redux/hooks';

interface StreamFormData {
  assetId: string;
  amount: string;
  receiverAddress: string;
  clawbackEnabled: boolean;
  clawbackAddress: string;
  startDate: string;
  endDate: string;
}

export default function NewStreamForm() {
  const { address } = useAppSelector(state => state.wallet);
  const [status, setStatus] = useState<string>('Waiting for form');
  const [formData, setFormData] = useState<StreamFormData>({
    assetId: '',
    amount: '',
    receiverAddress: '',
    clawbackEnabled: false,
    clawbackAddress: '',
    startDate: '',
    endDate: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Format date to YYYY-MM-DDThh:mm format for datetime-local input
  const formatDateForInput = (date: Date) => {
    return date.toISOString().slice(0, 16);
  };

  // Set default dates when component mounts
  useEffect(() => {
    const now = new Date();
    const oneMonthLater = new Date();
    oneMonthLater.setMonth(now.getMonth() + 1);

    setFormData(prev => ({
      ...prev,
      startDate: formatDateForInput(now),
      endDate: formatDateForInput(oneMonthLater)
    }));
  }, []);

  useEffect(() => {
    if (address && !formData.clawbackAddress && formData.clawbackEnabled) {
      setFormData(prev => ({
        ...prev,
        clawbackAddress: address
      }));
    }
  }, [address, formData.clawbackAddress, formData.clawbackEnabled]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Stream Details:', formData);
    // -----
    setStatus('YAK TEST');
    await new Promise(resolve => setTimeout(resolve, 3000));
    alert('TEST');
    // -----
    const now = new Date();
    const oneMonthLater = new Date();
    oneMonthLater.setMonth(now.getMonth() + 1);
    setFormData({
      assetId: '',
      amount: '',
      receiverAddress: '',
      clawbackEnabled: false,
      clawbackAddress: '',
      startDate: formatDateForInput(now),
      endDate: formatDateForInput(oneMonthLater)
    });
    setStatus('Waiting for form...');
  };

  if (!address) {
    return <div className='text-gray-500 px-4 pb-16'>Connect your wallet to create a stream</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-2xl">
      <div>
        <label className="block text-sm font-medium text-gray-700">Asset ID</label>
        <input
          type="text"
          name="assetId"
          value={formData.assetId}
          onChange={handleInputChange}
          pattern="^[0-9a-fA-F]{64}$"
          placeholder="32-byte hex string"
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Amount</label>
        <input
          type="number"
          name="amount"
          value={formData.amount}
          onChange={handleInputChange}
          step="0.001"
          min="0"
          placeholder="0.000"
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Receiver Address</label>
        <input
          type="text"
          name="receiverAddress"
          value={formData.receiverAddress}
          onChange={handleInputChange}
          pattern="^xch1[02-9a-z]{58}$"
          placeholder="xch1..."
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          required
        />
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          name="clawbackEnabled"
          checked={formData.clawbackEnabled}
          onChange={handleInputChange}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label className="ml-2 block text-sm text-gray-700">Enable Clawback</label>
      </div>

      {formData.clawbackEnabled && (
        <div>
          <label className="block text-sm font-medium text-gray-700">Clawback Address</label>
          <input
            type="text"
            name="clawbackAddress"
            value={formData.clawbackAddress}
            onChange={handleInputChange}
            pattern="^xch1[02-9a-z]{58}$"
            placeholder="xch1..."
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            required={formData.clawbackEnabled}
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">Start Date</label>
        <input
          type="datetime-local"
          name="startDate"
          value={formData.startDate}
          onChange={handleInputChange}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">End Date</label>
        <input
          type="datetime-local"
          name="endDate"
          value={formData.endDate}
          onChange={handleInputChange}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          required
          min={formData.startDate}
        />
      </div>

      <button
        type="submit"
        className="w-full px-4 py-2 font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
      >
        Generate Stream
      </button>
      <div className='text-gray-500 text-sm text-center'>Status: {status}</div>
    </form>
  );
} 