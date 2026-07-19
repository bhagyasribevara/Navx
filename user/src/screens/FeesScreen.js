import React, { useState, useEffect, useContext } from "react";
import { 
  View, Text, ScrollView, TouchableOpacity, StyleSheet, 
  ActivityIndicator, RefreshControl, Modal, TextInput 
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemeContext } from "../context/ThemeContext";
import api from "../api";
import { SHADOWS } from "../theme/designSystem";
import { LinearGradient } from 'expo-linear-gradient';

const RAZORPAY_KEY = "rzp_test_RwZJe3KOgTNbo6";

export default function FeesScreen({ navigation }) {
  const { colors } = useContext(ThemeContext);
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Payment Modal
  const [selectedFee, setSelectedFee] = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [paying, setPaying] = useState(false);

  const fetchFees = async () => {
    try {
      const res = await api.get("/student/fees");
      if (res.data.success) {
        setFees(res.data.fees || []);
      }
    } catch (e) {
      console.log("Failed to load fees details:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFees();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchFees();
  };

  const handleTriggerPayment = (fee) => {
    setSelectedFee(fee);
    setShowPayModal(true);
  };

  const handleSimulatePayment = async () => {
    setPaying(true);
    try {
      // Simulate transactionId signature verification
      const transactionId = "TXN_RP_" + Math.random().toString(36).substring(2, 10).toUpperCase();
      const res = await api.post("/student/fees/pay", {
        feeId: selectedFee._id,
        transactionId,
        paymentMethod: "Razorpay (Card/UPI)"
      });

      if (res.data.success) {
        alert(`Payment successful!\nReceipt ID: ${transactionId}`);
        setShowPayModal(false);
        fetchFees();
      }
    } catch (e) {
      alert("Payment checkout transaction failed.");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textSec, marginTop: 10 }}>Loading Fees…</Text>
      </View>
    );
  }

  const pendingFees = fees.filter(f => f.status === "Pending");
  const paidFees = fees.filter(f => f.status === "Paid");

  return (
    <View style={[styles.container, { backgroundColor: '#ffffff' }]}>
      <LinearGradient
        colors={['rgba(139, 92, 246, 0.22)', 'rgba(99, 102, 241, 0.10)', 'rgba(255, 255, 255, 0)']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 380 }}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Fee Receipts & Payments</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {/* Pending Invoices */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Pending Invoices</Text>
        {pendingFees.length > 0 ? (
          pendingFees.map(fee => (
            <View key={fee._id} style={[styles.feeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.feeTitle, { color: colors.text }]}>{fee.title}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>Due date: {new Date(fee.dueDate).toDateString()}</Text>
                <Text style={{ color: '#ef4444', fontWeight: '800', fontSize: 18, marginTop: 10 }}>₹{fee.amount.toLocaleString()}</Text>
              </View>
              <TouchableOpacity 
                style={[styles.payBtn, { backgroundColor: colors.primary }]}
                onPress={() => handleTriggerPayment(fee)}
              >
                <Ionicons name="card-outline" size={16} color="#fff" />
                <Text style={styles.payBtnText}>Pay Now</Text>
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="checkmark-circle" size={32} color="#10b981" />
            <Text style={{ color: colors.textSec, marginTop: 8, fontWeight: '600' }}>All fees are fully paid!</Text>
          </View>
        )}

        {/* Paid Invoices */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>Transaction History</Text>
        {paidFees.length > 0 ? (
          paidFees.map(fee => (
            <View key={fee._id} style={[styles.feeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.feeTitle, { color: colors.text }]}>{fee.title}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>Paid on: {new Date(fee.paidDate).toDateString()}</Text>
                <Text style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2, fontFamily: 'monospace' }}>Txn: {fee.transactionId}</Text>
                <Text style={{ color: '#10b981', fontWeight: '800', fontSize: 16, marginTop: 6 }}>₹{fee.amount.toLocaleString()}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: '#10b98115', borderColor: '#10b98140' }]}>
                <Text style={{ color: '#10b981', fontSize: 12, fontWeight: '700' }}>Paid</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>No payment history found.</Text>
        )}
      </ScrollView>

      {/* Razorpay Simulation Modal */}
      <Modal visible={showPayModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 16 }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>Razorpay Secure Checkout</Text>
              <TouchableOpacity onPress={() => setShowPayModal(false)}>
                <Ionicons name="close" size={24} color={colors.textSec} />
              </TouchableOpacity>
            </View>

            {selectedFee && (
              <View style={{ width: '100%', gap: 12 }}>
                <View style={{ padding: 12, backgroundColor: colors.border + '30', borderRadius: 10 }}>
                  <Text style={{ fontSize: 12, color: colors.textSec }}>PAYING FOR</Text>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 2 }}>{selectedFee.title}</Text>
                </View>

                <View style={{ padding: 12, backgroundColor: colors.border + '30', borderRadius: 10 }}>
                  <Text style={{ fontSize: 12, color: colors.textSec }}>TOTAL AMOUNT</Text>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: colors.primary, marginTop: 2 }}>₹{selectedFee.amount.toLocaleString()}</Text>
                </View>

                <View style={{ padding: 10, backgroundColor: '#f59e0b10', borderRadius: 8, borderWidth: 1, borderColor: '#f59e0b30' }}>
                  <Text style={{ fontSize: 11, color: '#f59e0b', fontWeight: '700' }}>Razorpay Credentials Mode:</Text>
                  <Text style={{ fontSize: 12, fontFamily: 'monospace', color: colors.textSec, marginTop: 4 }}>Key ID: {RAZORPAY_KEY}</Text>
                </View>

                <TouchableOpacity 
                  style={[styles.checkoutBtn, { backgroundColor: colors.primary }]}
                  disabled={paying}
                  onPress={handleSimulatePayment}
                >
                  {paying ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="shield-checkmark" size={18} color="#fff" />
                      <Text style={styles.checkoutBtnText}>Complete Payment</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    paddingTop: 10
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginVertical: 12 },
  feeCard: { padding: 16, borderRadius: 18, borderWidth: 1, marginBottom: 12, flexDirection: 'row', alignItems: 'center', ...SHADOWS.sm },
  feeTitle: { fontSize: 15, fontWeight: '800' },
  payBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  payBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  emptyCard: { padding: 24, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', ...SHADOWS.sm },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, alignItems: 'center' },
  checkoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, marginTop: 12 },
  checkoutBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' }
});
